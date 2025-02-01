import { $ } from 'bun';
import { parseArgs } from 'util';
import { OpenAI } from 'openai';
import { exists } from 'fs/promises';


const {
	positionals: [, , projectDirectory, query]
	} = parseArgs({
	args: Bun.argv,
	strict: true,
	allowPositionals: true,
});

if(!projectDirectory) throw Error('No project directory provided.');
if(!query) throw Error('No query provided.');
if(!await exists(projectDirectory)) throw Error('Project directory does not exist.');

console.log('Project directory:', projectDirectory);
console.log('Running query:', query);

$.cwd(projectDirectory);

const client = new OpenAI({
	baseURL: 'http://localhost:11434/v1',
});

const runner = await client.beta.chat.completions.runTools({
	// model: 'deepseek-r1:1.5b',
	// model: 'deepseek-r1:14b',
	// model: 'deepseek-r1:32b',
	// model: 'llama3:8b',
	// model: 'llama3:latest',
	model: 'llama3.2:1b-instruct-q8_0',
	// model: 'llama3.2:3b-instruct-fp16',
	// model: 'llava-phi3:latest',
	// model: 'llava:latest',
	// model: 'minicpm-v:latest',
	// model: 'mistral-small:24b',
	// model: 'qwen2.5-coder:1.5b',
	// model: 'vitali87/shell-commands-qwen2-1.5b-extended:latest',
	messages: [
		// { role: 'user', content: 'Why is the sky blue?' },
		{ role: 'system', content: 'You are a software engineer looking to research answers to questions related to a codebase of a project called Foo. It uses git for version control.' },
		{ role: 'user', content: query },
	],
	stream: true,
	tool_choice: 'auto',
	tools: [{
		type: 'function',
		function: {
			function: gitCommitHistory,
			parse: JSON.parse,
			description: 'Get commit history of the project',
			parameters: {
				type: "object",
				required: ["reasoning"],
				properties: {
					limit: {
						type: "number",
						description: "The number of commits to return.",
						default: 1,
					},
					verbose: {
						type: "boolean",
						description: "Whether to include verbose output.",
						default: 1,
					},
					reasoning: {
						type: "string",
						description: "Explanation for why this command is being run.",
					}
				}
			}
		}
	}, {
		type: 'function',
		function: {
			function: ls,
			parse: JSON.parse,
			description: 'List the contents of a directory',
			parameters: {
				type: "object",
				required: ["reasoning"],
				properties: {
					subDirectory: {
						type: "string",
						description: "The sub directory to list.",
					},
					reasoning: {
						type: "string",
						description: "Explanation for why this command is being run.",
					}
				}
			}
		}
	}, {
		type: 'function',
		function: {
			function: grep,
			parse: JSON.parse,
			description: 'List the contents of a directory',
			parameters: {
				type: "object",
				required: ["pattern", "reasoning"],
				properties: {
					pattern: {
						type: "string",
						description: "The pattern to search for.",
					},
					target: {
						type: "string",
						description: "The target to search.",
						default: ".",
					},
					recursive: {
						type: "boolean",
						description: "Whether to search recursively.",
						default: false,
					},
					verbose: {
						type: "boolean",
						description: "Whether to include verbose output.",
						default: true,
					},
					reasoning: {
						type: "string",
						description: "Explanation for why this command is being run.",
					}
				}
			}
		}
	}],
})
.on('message', (message) => console.log(`MESSAGE: `, message));

const finalContent = await runner.finalContent();
console.log('Final content:', finalContent);

async function gitCommitHistory(args: {limit?: number, reasoning: string, verbose?: boolean}) {
	const {
		limit = 1,
		verbose = false,
		reasoning
	} = args;
	console.log('REASON:', reasoning);
	console.log('RUNNING:', `git log -${limit}`);

	const result = await $`git log -${limit} ${verbose ? '-v' : ''}`.text();
	console.log('RESULT:', result);
	return result;
}

async function ls(args: { subDirectory?: string, reasoning: string}) {
	const {
		subDirectory,
		reasoning
	} = args;
	console.log('REASON:', reasoning);
	console.log('RUNNING:', `ls ${subDirectory}`);

	const result = await $`ls ${subDirectory}`.text();
	console.log('RESULT:', result);
	return result;
}

async function grep(args: {
		target?: string,
		pattern?: string,
		recursive?: boolean,
		verbose?: boolean,
		reasoning: string
	}) {
	const {
		target = '.',
		pattern,
		recursive = false,
		verbose = true,
		reasoning
	} = args;
	console.log('REASON:', reasoning);
	
	const result = await $`grep ${pattern || ''} ${target || ''} ${recursive ? '-r' : ''} ${verbose ? '-v' : ''}`.text();
	console.log('RESULT:', result);
	return result;
}