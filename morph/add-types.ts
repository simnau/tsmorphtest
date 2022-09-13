import { Project, SyntaxKind, Type } from "ts-morph";
import { ts } from "@ts-morph/common";

async function morph() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const sourceFile = project.getSourceFileOrThrow("src/functions/math.ts");

  const functions = sourceFile.getFunctions();

  functions.forEach((fn) => {
    const references = fn.findReferences();

    const paramTypes: { name: string; type: Set<Type<ts.Type>> }[] = [];
    const params = fn.getParameters();

    params.forEach((param) => {
      paramTypes.push({
        name: param.getName(),
        type: new Set<Type<ts.Type>>(),
      });
    });

    const referencedFiles = new Set<string>();

    references.forEach((referencedSymbol) => {
      referencedSymbol.getReferences().forEach((ref) => {
        referencedFiles.add(ref.getSourceFile().getFilePath());
      });
    });

    referencedFiles.forEach((referencedFile) => {
      const file = project.getSourceFileOrThrow(referencedFile);

      const functionCalls = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((child) => {
          const identifier = child.getFirstDescendantByKind(
            SyntaxKind.Identifier
          );

          return identifier?.getText() === fn.getName();
        });

      functionCalls.forEach((functionCall) => {
        const args = functionCall.getArguments();

        fn.getParameters().forEach((_, index) => {
          paramTypes[index].type.add(
            args[index].getType().getBaseTypeOfLiteralType()
          );
        });
      });
    });

    params.forEach((param, index) => {
      const resultingType = Array.from(paramTypes[index].type.values()).reduce(
        (result, type) => {
          if (!result.includes(type.getText())) {
            return result ? `${result} | ${type.getText()}` : type.getText();
          }

          return result;
        },
        ""
      );

      if (resultingType) {
        param.setType(resultingType);
      }
    });
  });

  await project.save();
}

morph();
