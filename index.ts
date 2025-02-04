import { parseArgs } from 'util';
import { exists } from 'fs/promises';
import { chdir } from 'process';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatOllama, Ollama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { tool } from '@langchain/core/tools';
import makeTools from './make-tools';

const {
	AI_SERVER = 'http://localhost:11434',
	MODEL,
} = process.env;

const {
	positionals: [, , projectDirectory, query],
} = parseArgs({
	args: process.argv,
	strict: true,
	allowPositionals: true,
});

if(!MODEL) throw new Error('No MODEL environment variable set.');
if(!projectDirectory) throw new Error('No project directory provided.');
if(!query) throw new Error('No query provided.');
if(!(await exists(projectDirectory))) throw new Error('Project directory does not exist.');

console.log(`Running "${MODEL}" on "${AI_SERVER}"`);
console.log('Project directory:', projectDirectory);
console.log('Running query:', query);

chdir(projectDirectory);

const llm = new ChatOllama({
	baseUrl: AI_SERVER,
	model: MODEL,
});

const tools = makeTools(projectDirectory);

const prompt = ChatPromptTemplate.fromMessages([
	["system", `You are a web developer who commonly uses React and related librariers. You are will research answers to questions related to a code project at ${projectDirectory}. The user will not be able to respond beyond the initial prompt. Continue to use the tools at your disposal until all options are exhausted to attempt to reach a conclusion. Tools are run in the context of the project.`],
	["placeholder", "{chat_history}"],
	["human", "{input}"],
	["placeholder", "{agent_scratchpad}"],
]);

const agent = await createToolCallingAgent({
	llm,
	tools,
	prompt,
});

console.log('Agent loaded.');

const agentExecutor = new AgentExecutor({
	agent,
	tools,
	returnIntermediateSteps: true,
});

try {
	
	const result = await agentExecutor.invoke({
		input: query,
	});
	console.log('FINAL RESPONSE:', result.output);
} catch (error) {
	console.error('Error during agent execution:', error);
}
