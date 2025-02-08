import { exists } from 'fs/promises';
import { $, file } from 'bun';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { join } from 'path';
import { glob } from 'glob';

export default (projectDirectory: string) => ([
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
		ls(projectDirectory),
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
		grep(projectDirectory),
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
		getFile(projectDirectory),
		{
			name: 'getFile',
			description: 'Retrieve a file from the project. Is always within the project directory.',
			schema: z.object({
				filePath: z.string().describe('Path to the file'),
				reasoning: z.string().describe('Reasoning for the file retrieval request'),
			}),
		}
	),
	tool(
		find(projectDirectory),
		{
			name: 'find',
			description: 'Recursively find files in a directory that match a given pattern.',
			schema: z.object({
				pattern: z.string().describe('Pattern to match files against, supports glob syntax'),
				subDirectory: z.string().optional().describe('Subdirectory to start search from. Is always within the project directory.'),
				reasoning: z.string().describe('Reasoning for the file search request'),
			}),
		}
	),
]);

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

function ls(projectDirectory: string) {
	return async (args: { subDirectory?: string, reasoning: string}) => {
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
	};
}

function grep(projectDirectory: string) {
	return async (args: {
		target?: string,
		pattern: string,
		reasoning: string
	}) => {
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

		
		try {
			console.log('RUNNING:', `grep --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -lrE "${pattern}" ${fullPath}`);
			const result = await $`grep --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -lrE "${pattern}" ${fullPath}`.text();
			console.log('RESULT:', result);
			return result;
		} catch(e) {
			// text() call with no results errors out or something?? Don't care.
			return 'No results';
		}
	}
}

function getFile(projectDirectory: string) {
	return async (args: { filePath: string, reasoning: string }) => {
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
	};
}

function find(projectDirectory: string) {
	return async (args: { 
		pattern: string, 
		subDirectory?: string, 
		reasoning: string 
	}) => {
		const {
			pattern,
			subDirectory = '',
			reasoning
		} = args;
		console.log('REASON (find):', reasoning);
		const searchPath = subDirectory.startsWith('/') ?
			join(projectDirectory, subDirectory.slice(1)) :
			join(projectDirectory, subDirectory);

		if (!(await exists(searchPath))) {
			console.log('RESULT: No such directory');
			return 'No such directory';
		}
		try {
			console.log('RUNNING:', `glob ${pattern} in ${searchPath}`);
			const files = await glob(join(searchPath, pattern), {
				nodir: true, // Do not match directories
				ignore: ['node_modules/**', 'dist/**', '.git/**'] // Exclude these directories by default
			});
			// Convert paths to be relative to the project directory for consistency
			const relativeFiles = files.map(file => file.slice(projectDirectory.length + 1));
			console.log('RESULT:', relativeFiles.join('\n'));
			return relativeFiles.join('\n');
		} catch (e) {
			console.error('Error during glob search:', e);
			return 'Error during search';
		}
	};
}
