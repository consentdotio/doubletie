'use client';

import { buttonVariants } from '~/components/docs/button';

import Link from 'next/link';
import { cn } from '~/lib/cn';

import { ArrowRight } from 'lucide-react';
import { AuroraText } from '../../../components/marketing/aurora-text';
import { BorderIcon } from '../../../components/marketing/border-icon';
import { Section } from '../../../components/marketing/section';
import { siteConfig } from '../config';

export function Hero() {
	return (
		<Section id="hero">
			<div className="relative mt-8 grid w-full gap-x-8 border">
				<div className="relative flex flex-col items-start justify-start space-y-6 px-4 pt-8 pb-6 sm:px-12">
					<h1 className="text-left font-semibold text-3xl text-foreground leading-tighter tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
						<span className="inline-block text-balance">
							<AuroraText className="leading-normal">
								{siteConfig.hero.title}
							</AuroraText>
						</span>
					</h1>
					<div className="flex w-full flex-col justify-between gap-6 sm:flex-row">
						<p className="z-20 max-w-xl text-balance text-left text-muted-foreground text-sm leading-normal sm:text-base lg:text-lg">
							{siteConfig.hero.description}
						</p>
						<div className="relative flex flex-col items-start justify-start gap-4 sm:flex-row sm:items-center sm:justify-end">
							<Link
								href={siteConfig.hero.cta.href}
								className={cn(
									buttonVariants({ variant: 'outline' }),
									'flex w-full gap-2 rounded-lg text-background sm:w-auto'
								)}
							>
								{siteConfig.hero.cta.text}
								<ArrowRight className="h-4 w-4 sm:h-6 sm:w-6" />
							</Link>
							<Link
								href={siteConfig.hero.demo.href}
								className={cn(
									buttonVariants({ variant: 'ghost' }),
									'flex w-full gap-2 rounded-lg sm:w-auto'
								)}
							>
								{siteConfig.hero.demo.text}
							</Link>
						</div>
					</div>
				</div>

				<BorderIcon className="-top-2 sm:-top-3 -left-2 sm:-left-3 absolute h-4 w-4 text-black sm:h-6 sm:w-6 dark:text-white" />
				<BorderIcon className="-bottom-2 sm:-bottom-3 -left-2 sm:-left-3 absolute h-4 w-4 text-black sm:h-6 sm:w-6 dark:text-white" />
				<BorderIcon className="-top-2 sm:-top-3 -right-2 sm:-right-3 absolute h-4 w-4 text-black sm:h-6 sm:w-6 dark:text-white" />
				<BorderIcon className="-bottom-2 sm:-bottom-3 -right-2 sm:-right-3 absolute h-4 w-4 text-black sm:h-6 sm:w-6 dark:text-white" />
			</div>
		</Section>
	);
}
