import { parseArgs } from 'util';
import { exists } from 'fs/promises';
import { chdir } from 'process';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatOllama, Ollama } from '@langchain/ollama';
import { $, file } from 'bun';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { join } from 'path';

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

const tools = [
	tool(
		gitCommitHistory,
		{
			name: 'gitCommitHistory',
			description: 'Get commit history of the project.',
			schema: z.object({
				limit: z.number().optional().describe('Number of commits to retrieve'),
				reasoning: z.string().describe('Reasoning for the commit history request'),
				verbose: z.boolean().optional().describe('Whether to include verbose commit details'),
			}),
		}
	),
	tool(
		ls,
		{
			name: 'ls',
			description: 'List the contents of a directory.',
			schema: z.object({
				subDirectory: z.string().optional().describe('Subdirectory to list. Is always within the project directory.'),
				reasoning: z.string().describe('Reasoning for the directory listing request'),
			}),
		}
	),
	tool(
		grep,
		{
			name: 'grep',
			description: 'Search for a pattern in files.',
			schema: z.object({
				target: z.string().optional().describe('Target directory or file. Is always within the project directory.'),
				pattern: z.string().describe('Search pattern'),
				reasoning: z.string().describe('Reasoning for the grep request'),
			}),
		}
	),
	tool(
		getFile,
		{
			name: 'getFile',
			description: 'Retrieve a file from the project. Is always within the project directory.',
			schema: z.object({
				filePath: z.string().describe('Path to the file'),
				reasoning: z.string().describe('Reasoning for the file retrieval request'),
			}),
		}
	),
];

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

async function gitCommitHistory(args: {limit?: number, reasoning: string, verbose?: boolean}) {
	const {
		limit = 1,
		verbose = false,
		reasoning
	} = args;
	console.log('REASON (gitCommitHistory):', reasoning);
	console.log('RUNNING:', `git log -${limit}`);

	const result = await $`git log -${limit} ${verbose ? '-v' : ''}`.text();
	console.log('RESULT:', result);
	return result;
}

async function ls(args: { subDirectory?: string, reasoning: string}) {
	const {
		subDirectory = '/',
		reasoning
	} = args;
	console.log('REASON (ls):', reasoning);

	const fullPath = subDirectory.startsWith(projectDirectory) ? projectDirectory : join(projectDirectory, subDirectory);

	if(!await exists(fullPath)) return 'No such directory';

	console.log('RUNNING:', `ls ${fullPath}`);

	const result = await $`ls ${fullPath || ''}`.text();
	console.log('RESULT:', result);
	return result;
}

async function grep(args: {
		target?: string,
		pattern: string,
		reasoning: string
	}) {
	const {
		target = '.',
		pattern,
		reasoning
	} = args;
	console.log('REASON (grep):', reasoning);

	if(!pattern.trim()) return 'No pattern to search for';

	const fullPath = target.startsWith('/') ?
		projectDirectory :
		join(projectDirectory, target);

	if(!fullPath.startsWith(projectDirectory)) {
		console.log(`RESULT: No such file or directory: ${fullPath}`);
		return `No such file or directory: ${fullPath}`;
	}

	if(!(await exists(fullPath))) {
		console.log(`RESULT: No such file or directory: ${fullPath}`);
		return `No such file or directory: ${fullPath}`;
	}

	console.log('RUNNING:', `grep --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -lrE "${pattern}" ${fullPath}`);
	
	try {
		const result = await $`grep --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -lrE "${pattern}" ${fullPath}`.text();
		console.log('RESULT:', result);
		return result;
	} catch(e) {
		console.error('Something went wrong');
		console.error(Object.keys((e as any)?.stderr?.toString() || {}));
		const x = await $`grep --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -lrE "${pattern}" ${fullPath}`.nothrow().quiet();
		console.log('----', x, x.stderr.toString(), x.stdout.toString(), x.arrayBuffer(), x.text());
		return 'Something went wrong';
	}
}

async function getFile(args: { filePath: string, reasoning: string }) {
	const {
		filePath,
		reasoning,
	} = args;

	console.log('REASON (getFile):', reasoning);
	
	const fullPath = filePath.startsWith(projectDirectory) ? projectDirectory : join(projectDirectory, filePath);

	console.log('RETRIEVING:', filePath);

	if(!(await exists(fullPath))) {
		console.log('RESULT: No such file.');
		return 'No such file';
	}

	return file(fullPath).text();
}