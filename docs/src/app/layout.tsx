import { C15TDevTools } from '@c15t/dev-tools';
import {
	ConsentManagerDialog,
	ConsentManagerProvider,
	CookieBanner,
} from '@c15t/react';

import { Fira_Mono, Inter } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';

import logger from '~/lib/logger';
import { cn } from '~/lib/cn';
import '~/lib/logger';
import './styles/global.css';

import { c15tConfig } from '../../c15t.config';
import Test from './test';

const inter = Inter({
	subsets: ['latin'],
	variable: '--font-inter',
});

const firaMono = Fira_Mono({
	subsets: ['latin'],
	weight: ['400', '500', '700'],
	variable: '--font-fira-mono',
});

export default function Layout({ children }: { children: ReactNode }) {

	const bgColor = '#FFFFFF';
	const bgColorDark = '#000000';
	const primaryColor = 'hsl(355, 100%, 70.4%)';
	const primaryColorHover = 'hsl(355, 100%, 70.4% / 0.1)';
	const focusRing = `${primaryColor} !important`;
	const focusShadow = `0 0 0 2px ${primaryColor}`;

	const baseTheme = {
		style: {
			'--button-focus-ring-dark': primaryColor,
			'--button-focus-ring': primaryColor,
			'--button-primary-dark': primaryColor,
			'--button-primary': primaryColor,
			'--button-shadow-primary-dark': `var(--button-shadow-dark), inset 0 0 0 1px ${primaryColor}`,
			'--button-shadow-primary-focus-dark': focusShadow,
			'--button-shadow-primary-focus': focusShadow,
			'--button-shadow-primary': `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
			'--button-primary-hover-dark': primaryColorHover,
			'--button-primary-hover': primaryColorHover,
		},
	};

	logger.info('Layout rendered');

	return (
		<html
			lang="en"
			className={cn(inter.variable, firaMono.variable)}
			suppressHydrationWarning
		>
			<body className="flex min-h-screen flex-col">
				<RootProvider>
					<ConsentManagerProvider options={c15tConfig}>
							<CookieBanner
							theme={{
								'banner.root': {
									style: {
										...baseTheme.style,
									},
								},
							}}
						/>
						<ConsentManagerDialog
							theme={{
								'dialog.root': {
									style: {
										...baseTheme.style,
										'--accordion-focus-ring-dark': focusRing,
										'--accordion-focus-ring': focusRing,
										'--accordion-focus-shadow-dark': focusShadow,
										'--accordion-focus-shadow': focusShadow,
										'--dialog-background-color-dark': bgColorDark,
										'--dialog-background-color': bgColor,
										'--dialog-branding-focus-color-dark': `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
										'--dialog-branding-focus-color': `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
										'--dialog-footer-background-color-dark': bgColorDark,
										'--switch-background-color-checked-dark': primaryColor,
										'--switch-background-color-checked': primaryColor,
										'--switch-background-color-unchecked-dark': bgColorDark,
										'--switch-background-color-unchecked': bgColor,
										'--switch-focus-shadow-dark': focusShadow,
										'--switch-focus-shadow': focusShadow,
										'--widget-accordion-background-color-dark': bgColorDark,
										'--widget-accordion-background-color': bgColor,
									},
								},
							}}
						/>
						{process.env.NODE_ENV === 'development' && <C15TDevTools />}
						{children}
						<Test/>
					</ConsentManagerProvider>
				</RootProvider>
			</body>
		</html>
	);
}
