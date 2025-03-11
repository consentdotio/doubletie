import { FeaturesSection } from './_components/features';

import type { Metadata } from 'next/types';
import { CTA } from './_components/cta';

import { Footer } from './_components/footer';
import { Hero } from './_components/hero';
import { siteConfig } from './config';

export const metadata: Metadata = {
	title: 'React Privacy Components for the Modern Web',
	description: siteConfig.hero.description,
};

export default function HomePage() {
	return (
		<>
			<Hero />
			<FeaturesSection />
			<CTA />
			<Footer />
		</>
	);
}
