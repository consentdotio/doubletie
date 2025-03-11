import type { LinkItemType } from 'fumadocs-ui/layouts/links';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { GithubIcon } from '~/components/icons/github';

export const linkItems: LinkItemType[] = [
	{
		type: 'icon',
		url: 'https://github.com/consentdotio/doubletie',
		text: 'Github',
		icon: <GithubIcon className="h-5 w-5" />,
		external: true,
	},
];

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const docsOptions: BaseLayoutProps = {
	nav: {
		title: "🪢 Double Tie",
		transparentMode: 'top',
	},
	links: [...linkItems],
};

export const homePageOptions: BaseLayoutProps = {
	nav: {
		title: "🪢 Double Tie",
		transparentMode: 'top',
	},
	links: [
		{
			text: 'Get Started',
			url: '/docs',
		},
	],
};
