import * as ts                        from "typescript";
import { Context }                    from "./contexts/Context";
import { ParameterDescriptionSource } from "./declarations";
import { getNativeTypeDescription }   from "./getNativeTypeDescription";
import { getTypeCall }                from "./getTypeCall";
import {
	getCtorTypeReference,
	getDeclaration,
	getType,
	getUnknownTypeCall
}                                     from "./helpers";


function getDefaultValueFromType(type: ts.Type | undefined) {
	if (!type) {
		return undefined
	}

	// if (type.flags & 512 /* TypeFlags.BooleanLiteral */) {
	// 	return (type ===  || type === checker.getFalseType(/*fresh*/ true)) ? ts.factory.createFalse() : ts.factory.createTrue();
	// }
	if (type.isStringLiteral()) {
		return ts.factory.createStringLiteral(type.value);
	}
	else if (type.isNumberLiteral()) {
		return ts.factory.createNumericLiteral(type.value);
	}
	else if (type.flags & 2048 /* TypeFlags.BigIntLiteral */) {
		// @ts-ignore
		return ts.factory.createBigIntLiteral(type.value);
	}
	// else if (type.isUnion()) {
	// 	return ts.firstDefined(type.types, function (t) { return getDefaultValueFromType(checker, t); });
	// }
	else if (type.isClass()) {
		const declaration = getDeclaration(type.symbol) as ts.ParameterDeclaration;
		if (!declaration)
			return undefined;
		const constructorDeclaration = ts.findAncestor(declaration, function (member) { return ts.isConstructorDeclaration(member) }) as ts.ConstructorDeclaration
		if (constructorDeclaration && constructorDeclaration.parameters.length)
			return undefined;
		return ts.factory.createNewExpression(ts.factory.createIdentifier(type.symbol.name), /*typeArguments*/ undefined, /*argumentsArray*/ undefined);
	}
	// else if (checker.isArrayLikeType(type)) {
	// 	return ts.factory.createArrayLiteralExpression();
	// }
	return undefined;
}

/**
 * Process the signature of the method and create a parameter description for each parameter
 *
 * @param {ts.Signature} signature
 * @param {Context} context
 * @returns {Array<ParameterDescriptionSource>}
 */
export function getSignatureParameters(signature: ts.Signature, context: Context): Array<ParameterDescriptionSource>
{
	const signatureParameters = signature.getParameters();

	if (!signature || !signatureParameters?.length)
	{
		return [];
	}

	const parameters: Array<ParameterDescriptionSource> = [];

	for (let parameterSymbol of signatureParameters)
	{
		const declaration = getDeclaration(parameterSymbol) as ts.ParameterDeclaration;
		const type = getType(parameterSymbol, context.typeChecker);

		// const initializer = declaration?.initializer && ts.isNewExpression(declaration?.initializer!) ?
		// 	null :
		// 	declaration.initializer

		const isNewClass = declaration?.initializer && ts.isNewExpression(declaration?.initializer!)


		parameters.push({
			n: parameterSymbol.getName(),
			t: type && getTypeCall(type, type.symbol, context, getCtorTypeReference(parameterSymbol)) || getUnknownTypeCall(context),
			o: declaration.questionToken !== undefined || declaration.initializer !== undefined || declaration.dotDotDotToken !== undefined,
			var: !!declaration?.dotDotDotToken,
			dv: isNewClass ? ts.factory.createFunctionExpression(
				undefined,
				undefined,
				undefined,
				undefined,
				[],
				undefined,
				ts.factory.createBlock([
					ts.factory.createReturnStatement(
						ts.factory.createCallExpression(
							ts.factory.createPropertyAccessExpression(
								ts.factory.createIdentifier("Promise"),
								ts.factory.createIdentifier("resolve")
							),
							undefined,
							[
								declaration.initializer
							]
						)
					)
				], true)
			) : declaration.initializer,
		});
	}

	return parameters;
}