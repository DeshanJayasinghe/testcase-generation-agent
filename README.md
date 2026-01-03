# AI-Driven Test Case Generation & Automatic Bug Fixing

## Overview

This project leverages LLM-powered dynamic agents to automate the generation of test cases and the application of bug fixes in software development. By utilizing natural language requirements and code metadata, the system can create JUnit and Jest/Cypress test cases, while also incorporating an Auto-Fix Agent for self-healing patches and closed-loop testing cycles.

## Features

- **Test Case Generation**: Automatically generate JUnit and Jest/Cypress test cases from code metadata and natural language requirements.
- **Auto-Fix Agent**: Suggest and apply self-healing patches to identified bugs, facilitating a closed-loop testing cycle.
- **Validation**: Ensure that generated test cases meet specified requirements through a dedicated validation agent.
- **Workflow Orchestration**: Coordinate interactions between various agents to manage the overall workflow efficiently.

## Project Structure

```
ai-test-generator
├── src
│   ├── agents
│   │   ├── testGeneratorAgent.ts
│   │   ├── autoFixAgent.ts
│   │   ├── validationAgent.ts
│   │   └── orchestratorAgent.ts
│   ├── config
│   │   ├── initChatModel.ts
│   │   └── agentConfig.ts
│   ├── tools
│   │   ├── codeAnalysisTool.ts
│   │   ├── testExecutionTool.ts
│   │   ├── patchGenerationTool.ts
│   │   └── requirementsParserTool.ts
│   ├── mcp
│   │   └── mcpClient.ts
│   ├── data
│   │   ├── testCaseStore.ts
│   │   ├── bugFixStore.ts
│   │   └── metadataExtractor.ts
│   ├── generators
│   │   ├── junitGenerator.ts
│   │   ├── jestGenerator.ts
│   │   └── cypressGenerator.ts
│   ├── parsers
│   │   ├── codeMetadataParser.ts
│   │   └── requirementsParser.ts
│   ├── executors
│   │   ├── junitExecutor.ts
│   │   └── jestExecutor.ts
│   ├── workflows
│   │   ├── testGenWorkflow.ts
│   │   ├── autoFixWorkflow.ts
│   │   └── closedLoopWorkflow.ts
│   ├── types
│   │   └── index.ts
│   └── index.ts
├── tests
│   ├── unit
│   │   └── agents.test.ts
│   └── integration
│       └── workflows.test.ts
├── examples
│   ├── java-sample
│   │   └── Calculator.java
│   └── typescript-sample
│       └── utils.ts
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Getting Started

1. **Clone the Repository**: 
   ```
   git clone <repository-url>
   cd ai-test-generator
   ```

2. **Install Dependencies**: 
   ```
   npm install
   ```

3. **Run the Application**: 
   ```
   npm start
   ```

4. **Run Tests**: 
   ```
   npm test
   ```

## Usage

- To generate test cases, provide the necessary code metadata and natural language requirements to the TestGeneratorAgent.
- The AutoFixAgent can be invoked to apply patches to identified bugs, ensuring a seamless testing experience.
- Utilize the orchestrator agent to manage the workflow and coordinate between different agents.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.