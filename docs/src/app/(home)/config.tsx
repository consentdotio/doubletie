import {
	Brain,
	CodeIcon,
	DatabaseIcon,
	NetworkIcon,
	PackageIcon,
	ServerIcon,
	ShieldIcon,
	ZapIcon,
} from 'lucide-react';

export const siteConfig = {
	name: 'Double Tie',
	description:
		'A TypeScript toolkit for building self-hostable backend SDKs. Create type-safe, distributable backend services with ease.',
	url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
	keywords: [
		'TypeScript',
		'Backend SDK',
		'Self-hosting',
		'Type Safety',
		'Database Tools',
		'Query Builder',
	],
	links: {
		email: 'support@doubletie.com',
		github: 'https://github.com/consentdotio/doubletie',
	},
	hero: {
		title: 'Make Self Hosted SDK Easier',
		description:
			'Build and distribute type-safe, self-hostable backend services as npm packages. Complete with database tools, SDK builders, and deployment options.',
		cta: { text: 'Get Started', href: '/docs/packages/query-builder' },
		demo: {
			text: 'View on GitHub',
			href: 'https://github.com/consentdotio/doubletie',
		},
	},
	features: [
		{
			name: 'Type Safety First',
			description: 'End-to-end type inference from database to client.',
			icon: <CodeIcon className="h-6 w-6" />,
		},
		{
			name: 'Query Builder',
			description: 'Type-safe, functional query builder built on Kysely.',
			icon: <DatabaseIcon className="h-6 w-6" />,
		},
		{
			name: 'Self-Hostable',
			description: 'Package your backend as distributable npm modules.',
			icon: <PackageIcon className="h-6 w-6" />,
		},
		{
			name: 'Multiple Deploy Targets',
			description: 'Deploy to Docker, AWS, Vercel, and more.',
			icon: <ServerIcon className="h-6 w-6" />,
		},
		{
			name: 'Modular Architecture',
			description: 'Composable packages with a flexible adapter system.',
			icon: <Brain className="h-6 w-6" />,
		},
		{
			name: 'Performance First',
			description: 'Minimal overhead, optimized for production.',
			icon: <ZapIcon className="h-6 w-6" />,
		},
		{
			name: 'Data Privacy',
			description: 'Complete control through self-hosting capabilities.',
			icon: <ShieldIcon className="h-6 w-6" />,
		},
		{
			name: 'Developer Experience',
			description: 'Modern TypeScript patterns and intuitive APIs.',
			icon: <CodeIcon className="h-6 w-6" />,
		},
	],
	footer: {
		links: [
			{
				title: 'Product',
				items: [
					{ text: 'Documentation', url: '/docs' },
					{ text: 'Query Builder', url: '/docs/packages/query-builder' },
				],
			},
			{
				title: 'Company',
				items: [
					{
						text: 'GitHub',
						url: 'https://github.com/consentdotio/doubletie',
						external: true,
					},
					{
						text: 'Contact',
						url: 'mailto:support@doubletie.com',
						external: true,
					},
				],
			},
			{
				title: 'Legal',
				items: [
					{ text: 'License', url: '/docs/legals/license' },
					{ text: 'Contributing', url: '/docs/getting-started/contributing' },
				],
			},
		],
		bottomText:
			'Build and distribute type-safe, self-hostable backend services as npm packages. Complete with database tools, SDK builders, and deployment options.',
	},
};

export type SiteConfig = typeof siteConfig;
