/**
 * Core types for AI-Driven Test Case Generation & Automatic Bug Fixing
 */

export interface CodeMetadata {
  filePath: string;
  language: 'java' | 'typescript' | 'javascript';
  className?: string;
  functions: FunctionMetadata[];
  imports?: string[];
  dependencies?: string[];
}

export interface FunctionMetadata {
  name: string;
  parameters: Parameter[];
  returnType: string;
  visibility?: string;
  isStatic?: boolean;
  lineStart: number;
  lineEnd: number;
  documentation?: string;
}

export interface Parameter {
  name: string;
  type: string;
  optional?: boolean;
}

export interface Requirement {
  id: string;
  description: string;
  type: 'functional' | 'edge-case' | 'error-handling' | 'performance';
  priority: 'high' | 'medium' | 'low';
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'junit' | 'jest' | 'cypress';
  code: string;
  targetFunction: string;
  filePath: string;
  generatedAt: Date;
  requirements?: string[];
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  executionTime: number;
  error?: string;
  stackTrace?: string;
  output?: string;
  timestamp: Date;
}

export interface BugFix {
  id: string;
  testCaseId: string;
  testResultId: string;
  description: string;
  originalCode: string;
  fixedCode: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  applied: boolean;
  appliedAt?: Date;
  validated: boolean;
  retestResult?: TestResult;
}

export interface WorkflowState {
  stage: 'parsing' | 'generating' | 'executing' | 'fixing' | 'validating' | 'completed' | 'failed';
  codeMetadata?: CodeMetadata;
  requirements?: Requirement[];
  testCases?: TestCase[];
  testResults?: TestResult[];
  bugFixes?: BugFix[];
  errors?: string[];
}

export interface AgentConfig {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  enableTools: boolean;
}

export interface StoreEntry<T> {
  id: string;
  data: T;
  timestamp: Date;
  userId?: string;
}