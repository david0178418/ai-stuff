import { $ } from 'bun';
import { OpenAI } from 'openai';

await $`echo "Hello World!"`;

await $`cd ../recruiting-crx && git log -1 --format=%ad`;

const client = new OpenAI({
	baseURL: 'http://localhost:11434/v1',
});

const runner = await client.beta.chat.completions.runTools({
	// model: 'deepseek-r1:1.5b',
	// model: 'deepseek-r1:14b',
	// model: 'deepseek-r1:32b',
	// model: 'llama3:8b',
	// model: 'llama3:latest',
	// model: 'llama3.2:1b-instruct-q8_0',
	model: 'llama3.2:3b-instruct-fp16',
	// model: 'llava-phi3:latest',
	// model: 'llava:latest',
	// model: 'minicpm-v:latest',
	// model: 'mistral-small:24b',
	// model: 'qwen2.5-coder:1.5b',
	// model: 'vitali87/shell-commands-qwen2-1.5b-extended:latest',
	messages: [
		// { role: 'user', content: 'Why is the sky blue?' },
		{ role: 'system', content: 'You are a software engineer looking to research answers to questions related to a codebase of a project called Foo. It uses git for version control.' },
		{ role: 'user', content: 'When was the last commit to the project?' },
	],
	stream: true,
	tool_choice: 'auto',
	tools: [{
		type: 'function',
		function: {
			function: cli,
			// name: 'cli',
			parse: JSON.parse,
			description: 'Execute a shell command and receive the output. They are executed in the context of the Foo project directory.',
			parameters: {
				type: "object",
				required: ["cmd", "reasoning"],
				properties: {
					cmd: {
						type: "string",
						description: "The shell command to execute"
					},
					reasoning: {
						type: "string",
						description: "Explanation for why this command is being run"
					}
				}
			}
		}
	}],
})
.on('message', (message) => console.log(`MESSAGE: `, message));

async function cli({cmd, reasoning}: {cmd: string, reasoning: string}) {
	console.log(`REASON: ${reasoning}`);
	const x = `cd ../recruiting-crx && ${cmd}`
	console.log(`RUNNING: ${x}`);
	const result = await $`${x}`.text();
	console.log('RESULT:', result);
	return result;
}

// for await (const chunk of stream) {
// 	process.stdout.write(chunk.choices[0]?.delta?.content || '');
// }


const finalContent = await runner.finalContent();
console.log();
console.log('Final content:', finalContent);

process.stdout.write('\n')

