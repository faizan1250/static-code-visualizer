const Parser = require('tree-sitter');
const CPP = require('tree-sitter-cpp');

const parser = new Parser();
parser.setLanguage(CPP);

function parseCppCode(code) {
  const tree = parser.parse(code);
  const root = tree.rootNode;

  const spec = {
    variables: [],
    flow: [],
    steps: [],
    variableUpdates: [],
    callStack: [],
    returns: [],
    dataStructures: [], // new: track structs/classes (trees, graphs, nodes)
    pointerAssignments: [], // new: track pointer field updates
    allocations: [], // new: track 'new' expressions (node creations)
  };

  walkTree(root, spec, null);
  return spec;
}

function walkTree(node, spec, currentFunc = null) {
  if (!node) return;

  switch (node.type) {

    // --- Variable declaration / initialization ---

    case 'init_declarator': {
      const idNode = node.childForFieldName('declarator');
      const valNode = node.childForFieldName('value');
      if (idNode) {
        const name = idNode.text;
        const line = node.startPosition.row + 1;
        let value = valNode ? valNode.text : null;

        let variable = { name, line };

        // Detect pointer type by '*' presence in declarator
        if (idNode.text.includes('*') || node.parent?.type === 'pointer_declarator') {
          variable.type = 'pointer';
          variable.value = value;
        }
        // Detect array initialization by braces or vector-like
        else if (value && value.startsWith('{')) {
          variable.type = 'array';
          variable.values = value.slice(1, -1).split(',').map(v => parseInt(v.trim()));
        } else if (value && value.includes('(')) {
          variable.type = 'array';
          variable.value = value; // vector<int> dp(n+1, -1)
        } else {
          variable.type = 'int';
          variable.value = value ? parseInt(value) : null;
        }

        spec.variables.push(variable);
        spec.steps.push({ line, action: 'declare', var: name, value });
      }
      break;
    }

    // --- Assignment ---

    case 'assignment_expression': {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      const line = node.startPosition.row + 1;

      if (left && right) {
        const leftText = left.text;
        const rightText = right.text;

        // Detect pointer member assignment like curr->next = node;
        const pointerAssign = (left.type === 'member_expression' || left.type === 'field_expression') 
          && (left.child(1)?.type === 'field_identifier' || left.child(1)?.type === 'field_expression');

        if (left.type === 'member_expression' || left.type === 'field_expression' || leftText.includes("->")) {
          // Register pointer assignment specially
          spec.pointerAssignments.push({
            from: left.child(0)?.text ?? null, // e.g. 'curr'
            field: left.child(1)?.text ?? null, // e.g. 'next'
            value: rightText,
            line,
            type: 'pointer-assignment',
            fullLeft: leftText,
          });

          spec.steps.push({
            line,
            action: 'pointer-assign',
            target: leftText,
            value: rightText,
          });

        } else {
          // Normal variable assignment
          spec.variableUpdates.push({
            name: leftText,
            value: rightText,
            line
          });

          spec.steps.push({
            line,
            action: 'assign',
            var: leftText,
            value: rightText
          });
        }
      }
      break;
    }

    // --- Function definitions ---

    case 'function_definition': {
      const nameNode = node.childForFieldName('declarator');
      const bodyNode = node.childForFieldName('body');
      const line = node.startPosition.row + 1;

      if (nameNode) {
        spec.flow.push({
          type: 'function-definition',
          name: nameNode.text,
          body: bodyNode ? bodyNode.text : null,
          line
        });
      }

      currentFunc = nameNode?.text ?? null;
      break; // Walk children after this
    }

    // --- Loops ---

    case 'for_statement': {
      const initNode = node.childForFieldName('initializer');
      const conditionNode = node.childForFieldName('condition');
      const updateNode = node.childForFieldName('update');
      const line = node.startPosition.row + 1;

      spec.flow.push({
        type: 'for-loop',
        initializer: initNode?.text ?? null,
        condition: conditionNode?.text ?? null,
        update: updateNode?.text ?? null,
        body: node.childForFieldName('body')?.text ?? null,
        line
      });

      spec.steps.push({
        line,
        action: 'loop-start',
        condition: conditionNode?.text ?? null
      });
      break;
    }

    // --- Conditionals ---

    case 'if_statement': {
      const conditionNode = node.childForFieldName('condition');
      const consequenceNode = node.childForFieldName('consequence');
      const line = node.startPosition.row + 1;

      spec.flow.push({
        type: 'if',
        condition: conditionNode?.text ?? null,
        consequence: consequenceNode?.text ?? null,
        line
      });

      spec.steps.push({
        line,
        action: 'condition-check',
        condition: conditionNode?.text ?? null
      });
      break;
    }

    // --- Function calls ---

    case 'call_expression': {
      const fnNode = node.child(0);
      const argsNode = node.childForFieldName('arguments');
      const line = node.startPosition.row + 1;
      const name = fnNode?.text ?? 'unknown';

      spec.flow.push({
        type: 'function-call',
        name,
        arguments: argsNode?.text ?? null,
        line
      });

      spec.steps.push({
        line,
        action: 'call',
        function: name,
        args: argsNode?.text ?? ''
      });

      // Handle recursion
      if (name === currentFunc) {
        spec.callStack.push({
          function: name,
          args: argsNode?.text ?? null,
          line
        });
      }
      break;
    }

    // --- Return ---

    case 'return_statement': {
      const returnExpr = node.namedChildren[0]?.text;
      const line = node.startPosition.row + 1;

      spec.steps.push({
        line,
        action: 'return',
        value: returnExpr ?? 'void'
      });

      spec.returns.push({
        line,
        value: returnExpr ?? 'void'
      });
      break;
    }

    // --- Structs and classes for trees/graphs ---

    case 'struct_specifier':
    case 'class_specifier': {
      const nameNode = node.childForFieldName('name');
      const bodyNode = node.childForFieldName('body');
      const line = node.startPosition.row + 1;

      let fields = [];
      if (bodyNode) {
        for (const child of bodyNode.namedChildren) {
          if (child.type === 'field_declaration') {
            const typeNode = child.childForFieldName('type');
            const declaratorNode = child.childForFieldName('declarator');

            fields.push({
              type: typeNode?.text ?? null,
              name: declaratorNode?.text ?? null,
              isPointer: declaratorNode?.text?.includes('*') || false,
            });
          }
        }
      }

      spec.dataStructures.push({
        type: node.type === 'struct_specifier' ? 'struct' : 'class',
        name: nameNode?.text ?? null,
        fields,
        line,
      });
      break;
    }

    // --- New expressions for node allocations ---

    case 'new_expression': {
      const typeNode = node.childForFieldName('type');
      const argsNode = node.childForFieldName('arguments');
      const line = node.startPosition.row + 1;

      spec.allocations.push({
        typeName: typeNode?.text ?? null,
        args: argsNode?.text ?? null,
        line,
        action: 'allocate-node',
      });
      spec.steps.push({
        line,
        action: 'allocate',
        type: typeNode?.text ?? null,
        args: argsNode?.text ?? null,
      });
      break;
    }

  }

  for (const child of node.namedChildren) {
    walkTree(child, spec, currentFunc);
  }
}

module.exports = parseCppCode;
