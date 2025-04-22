import pc from 'picocolors';
import tinygradient from 'tinygradient';

// Define types locally instead of importing them
type TinyGradient = any;
type ArcMode = 'short' | 'long';
type ColorInput = any;
type TinyColor = any;

// Define regex at top level scope for better performance
const HEX_COLOR_REGEX = /#(?:[0-9a-f]{3}){1,2}/i;

// Minimal implementation to handle hex colors with picocolors
// This is limited since picocolors doesn't support hex directly
const applyHexColor = (hexColor: string, text: string): string => {
	// Map hex colors to closest picocolors colors
	// This is a very basic implementation - could be improved with better color mapping
	if (hexColor.match(HEX_COLOR_REGEX)) {
		// Use closest named color based on general brightness
		const r = Number.parseInt(hexColor.substring(1, 3), 16);
		const g = Number.parseInt(hexColor.substring(3, 5), 16);
		const b = Number.parseInt(hexColor.substring(5, 7), 16);
		const brightness = (r * 299 + g * 587 + b * 114) / 1000;

		// Very basic mapping based on brightness and dominant color
		if (brightness < 128) {
			if (r > Math.max(g, b)) {
				return pc.red(text);
			}
			if (g > Math.max(r, b)) {
				return pc.green(text);
			}
			if (b > Math.max(r, g)) {
				return pc.blue(text);
			}
			return pc.gray(text);
		}

		// Bright colors
		if (r > Math.max(g, b)) {
			return pc.red(text);
		}
		if (g > Math.max(r, b)) {
			return pc.green(text);
		}
		if (b > Math.max(r, g)) {
			return pc.blue(text);
		}
		return pc.white(text);
	}

	// Default fallback
	return text;
};

interface GradientOptions {
	interpolation?: 'rgb' | 'hsv';
	hsvSpin?: 'short' | 'long';
}

// Define a function type instead of an interface with a call signature
type GradientFunction = {
	(str: string): string;
	multiline: (str: string) => string;
};

// Simplified creator function
const gradient = (
	colors: ColorInput[],
	options?: GradientOptions
): GradientFunction => {
	// Check input first
	if (!colors || colors.length === 0) {
		throw new Error('Missing gradient colors');
	}

	const grad: TinyGradient = tinygradient(colors);
	const opts = validateOptions(options || {});

	const fn = (str: string): string => {
		return applyGradient(str ? str.toString() : '', grad, opts);
	};

	fn.multiline = (str: string): string =>
		multiline(str ? str.toString() : '', grad, opts);

	return fn;
};

const getColors = (
	gradient: TinyGradient,
	options: GradientOptions,
	count: number
): TinyColor[] => {
	return options.interpolation?.toLowerCase() === 'hsv'
		? gradient.hsv(count, (options.hsvSpin?.toLowerCase() as ArcMode) || false)
		: gradient.rgb(count);
};

function applyGradient(
	str: string,
	gradient: TinyGradient,
	opts?: GradientOptions
): string {
	const options = validateOptions(opts);
	const colorsCount = Math.max(
		str.replace(/\s/g, '').length,
		gradient.stops.length
	);
	const colors: TinyColor[] = getColors(gradient, options, colorsCount);
	let result = '';

	for (const s of str) {
		result += s.match(/\s/g)
			? s
			: applyHexColor(colors.shift()?.toHex() || '#000', s);
	}

	return result;
}

export function multiline(
	str: string,
	gradient: TinyGradient,
	opts?: GradientOptions
): string {
	const options = validateOptions(opts);
	const lines = str.split('\n');
	const maxLength = Math.max(
		...lines.map((l) => l.length),
		gradient.stops.length
	);
	const colors = getColors(gradient, options, maxLength);
	const results: string[] = [];

	for (const line of lines) {
		const lineColors = colors.slice(0);
		let lineResult = '';

		for (const l of line) {
			lineResult += applyHexColor(lineColors.shift()?.toHex() || '#000', l);
		}

		results.push(lineResult);
	}

	return results.join('\n');
}

function validateOptions(opts?: GradientOptions): GradientOptions {
	const options: GradientOptions = {
		interpolation: 'rgb',
		hsvSpin: 'short',
		...opts,
	};

	if (opts !== undefined && typeof opts !== 'object') {
		throw new TypeError(
			`Expected \`options\` to be an \`object\`, got \`${typeof opts}\``
		);
	}

	if (typeof options.interpolation !== 'string') {
		throw new TypeError(
			`Expected \`options.interpolation\` to be \`rgb\` or \`hsv\`, got \`${typeof options.interpolation}\``
		);
	}

	if (
		options.interpolation.toLowerCase() === 'hsv' &&
		typeof options.hsvSpin !== 'string'
	) {
		throw new TypeError(
			`Expected \`options.hsvSpin\` to be a \`short\` or \`long\`, got \`${typeof options.hsvSpin}\``
		);
	}

	return options;
}

// Export the gradient function
export default gradient;
