import {
	CommonTableExpressionNameNode,
	DeleteQueryBuilder,
	Expression,
	InsertQueryBuilder,
	OperationNode,
	QueryCreator,
	UpdateQueryBuilder,
} from 'kysely';
import { ShallowRecord } from './type-utils.js';

/**
 * Parses a string like 'id, first_name' into a type 'id' | 'first_name'
 */
type ExtractColumnNamesFromColumnList<R extends string> =
	R extends `${infer C}, ${infer RS}`
		? C | ExtractColumnNamesFromColumnList<RS>
		: R;

/**
 * Parses a string like 'person(id, first_name)' into a type:
 *
 * {
 *   id: any,
 *   first_name: any
 * }
 *
 */
export type ExtractRowFromCommonTableExpressionName<CN extends string> =
	CN extends `${string}(${infer CL})`
		? { [C in ExtractColumnNamesFromColumnList<CL>]: any }
		: ShallowRecord<string, any>;

export interface CommonTableExpressionNode extends OperationNode {
	readonly kind: 'CommonTableExpressionNode';
	readonly name: CommonTableExpressionNameNode;
	readonly materialized?: boolean;
	readonly expression: OperationNode;
}

export type CommonTableExpression<DB, CN extends string> = (
	creator: QueryCreator<DB>
) => CommonTableExpressionOutput<DB, CN>;

type CommonTableExpressionOutput<DB, CN extends string> =
	| Expression<ExtractRowFromCommonTableExpressionName<CN>>
	| InsertQueryBuilder<DB, any, ExtractRowFromCommonTableExpressionName<CN>>
	| UpdateQueryBuilder<
			DB,
			any,
			any,
			ExtractRowFromCommonTableExpressionName<CN>
	  >
	| DeleteQueryBuilder<DB, any, ExtractRowFromCommonTableExpressionName<CN>>;
