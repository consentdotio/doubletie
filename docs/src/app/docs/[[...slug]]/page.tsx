
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';
import { cn } from '~/lib/cn';
import { docsSource } from '~/lib/source';
import type { Source } from '~/lib/source';
import { getMDXComponents } from '~/mdx-components';

import { createRelativeLink } from 'fumadocs-ui/mdx';

interface SharedDocsPageProps {
	params: { slug?: string[] };
	source: Source;
	otherComponents?: Record<string, ComponentType>;
}

function SharedDocsPage({
	params,
	source,
}: SharedDocsPageProps) {
	const page = source.getPage(params.slug);

	if (!page) {
		notFound();
	}

	const MDXContent = page.data.body;

	return (
		<DocsPage
			toc={page.data.toc}
			full={page.data.full}
			tableOfContent={{ style: 'clerk' }}
		>
			<DocsTitle className="tracking-tighter lg:text-4xl">
				{page.data.title}
			</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody className={cn()}>
			<MDXContent
					components={getMDXComponents({
						// this allows you to link to other pages with relative file paths
						a: createRelativeLink(source, page),
					})}
				/>
			</DocsBody>
		</DocsPage>
	);
}

function generateSharedMetadata(
	params: { slug?: string[] },
	source: Source
): Metadata {
	const page = source.getPage(params.slug);

	if (!page) {
		notFound();
	}

	return {
		title: page.data.title,
		description: page.data.description,
		openGraph: {
			title: page.data.title,
			description: page.data.description,
			type: 'website',
			images: [
				{
					url: `/og?slug=${params.slug?.join('/') ?? ''}`,
					width: 1200,
					height: 630,
				},
			],
		},
	};
}

/**
 * The main documentation page component that renders content based on the current slug.
 *
 * @param props - The component props
 * @param props.params - A promise containing the route parameters
 * @param props.params.slug - Optional array of path segments representing the current page path
 * @returns The rendered documentation page
 */
export default async function Page(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	return SharedDocsPage({ params, source: docsSource });
}

/**
 * Generates the static paths for all documentation pages at build time.
 *
 * @returns A promise that resolves to an array of valid route parameters
 */
export const generateStaticParams = async () => docsSource.generateParams();

/**
 * Generates the metadata for the current documentation page.
 *
 * @param props - The metadata generation props
 * @param props.params - A promise containing the route parameters
 * @param props.params.slug - Optional array of path segments representing the current page path
 * @returns The page metadata including title, description and OpenGraph data
 */
export async function generateMetadata(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const params = await props.params;
	return generateSharedMetadata(params, docsSource);
}
