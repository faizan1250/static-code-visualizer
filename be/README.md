# 🔍 AlgoVisor — Visualize C++ Algorithms in Action

**AlgoVisor** is a web-based tool that allows users to upload or write C++ code and **visualize the algorithm’s execution** in real-time. From loops and conditionals to recursion and call stacks — this app brings your code to life step by step. It's built with ❤️ and lots of console logs.

---

## ✨ Features

- 💻 **C++ Code Parser**: Built with `tree-sitter` to understand user-submitted C++ code.
- 🔬 **Execution Flow Analysis**:
  - Line-by-line tracing
  - Variable stack tracking
  - Call stack visualization with recursion support
  - Loop iteration and condition evaluation tracking
- 🎨 **Frontend Visualizer**: React-based interface that renders control flow using animated structures like arrays, trees, and stacks.
- 📦 **Modular Backend**:
  - Accepts C++ code
  - Returns structured JSON output with detailed execution metadata

---

## ⚙️ Tech Stack

### 🧠 Backend
- Node.js
- `tree-sitter` (C++ grammar)
- Custom parser logic for control flow + variable tracking

### 🎨 Frontend
- React + TypeScript
- Visual rendering of data structures and execution flow
- Interactive step-by-step play/pause controls (coming soon)

---

## 🗂 Example JSON Output (Simplified)
```json
{
  "language": "cpp",
  "variables": [
    { "name": "i", "type": "int", "initialValue": 0 }
  ],
  "executionSteps": [
    { "line": 1, "description": "int i = 0;", "variables": { "i": 0 } },
    { "line": 2, "description": "i < 5", "conditionResult": true },
    { "line": 3, "description": "cout << i;", "output": "0" },
    { "line": 4, "description": "i++", "variables": { "i": 1 } }
  ]
}
