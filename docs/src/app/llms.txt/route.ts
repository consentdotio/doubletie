import * as fs from 'node:fs/promises';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkStringify from 'remark-stringify';

export const revalidate = false;

export async function GET() {
	// Fetch all documents
	const files = await fg(['./src/content/**/*.mdx']);

	const scannedDocuments = await Promise.all(
		files.map(async (file) => {
			try {
				const fileContent = await fs.readFile(file);
				const { content, data } = matter(fileContent.toString());
				return {
					file: file,
					meta: data,
					content: await processContent(content),
				};
			} catch (error) {
				console.error(`Error processing file ${file}:`, error);
				return null; // Handle error appropriately
			}
		})
	);

	// Generate llms.txt content
	const llmsContent = generateLlmsTxtContent(scannedDocuments);

	// Return llms.txt content as plain text
	return new Response(llmsContent, {
		headers: { 'Content-Type': 'text/plain' },
	});
}

// Function to generate the content for llms.txt
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function generateLlmsTxtContent(documents: any[]): string {
	let content = '# Introduction to Doubletie \n';

	// biome-ignore lint/complexity/noForEach: <explanation>
	documents.forEach((doc) => {
		if (doc) {
			// Construct the slug based on the file path
			const slug = doc.file
				.replace('./src/content/', '')
				.replace('.mdx', '')
				.replace('/index', '');
			const externalLink = `https://doubletie.com/docs/${slug}`;
			content += `- [${doc.meta.title || 'Untitled'}](${externalLink}): ${doc.meta.description || 'No description available'}\n`;
		}
	});

	content +=
		'\n## Optional Resources\n- [Advanced Topics](https://doubletie.com/docs/advanced): In-depth guides\n- [Examples](https://doubletie.com/docs/examples): Code samples\n';
	return content;
}

// Function to process content
async function processContent(content: string): Promise<string> {
	const file = await remark()
		.use(remarkMdx)
		.use(remarkGfm)
		.use(remarkStringify)
		.process(content);

	return String(file);
}
