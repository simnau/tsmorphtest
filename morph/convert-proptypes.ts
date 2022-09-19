import {
  Project,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
  Writers,
} from "ts-morph";

const propTypesToTypesMap = {
  bool: "boolean",
  string: "string",
  number: "number",
} as const;

type TypeDefinition = Record<string, string>;

function propTypeToType(
  property: PropertyAssignment,
  propTypesImportName: string
): string {
  const initializer = property.getInitializer();

  if (initializer.getKind() === SyntaxKind.Identifier) {
    // TODO: handle complex shapes
    return "any";
  }

  if (initializer.getKind() === SyntaxKind.PropertyAccessExpression) {
    const propertyAccess = initializer.asKind(
      SyntaxKind.PropertyAccessExpression
    );

    const isPropTypes =
      propertyAccess.getExpression().getText() === propTypesImportName;

    if (!isPropTypes) {
      return "any";
    }

    const type = propTypesToTypesMap[propertyAccess.getName()];

    return type ? type : "any";
  }

  return "any";
}

function morphFile(file: SourceFile) {
  const propTypesImportName = file
    .getDescendantsOfKind(SyntaxKind.ImportDeclaration)
    .find((importDeclaration) => {
      const moduleSpecifier = importDeclaration.getModuleSpecifierValue();

      return (
        moduleSpecifier === "extended-proptypes" ||
        moduleSpecifier === "prop-types"
      );
    })
    ?.getImportClause()
    .getFirstDescendantByKind(SyntaxKind.Identifier)
    ?.getText();

  if (!propTypesImportName) {
    return;
  }

  const expressions = file
    .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
    .filter((expression) => {
      const binaryExpressions = expression.getDescendantsOfKind(
        SyntaxKind.BinaryExpression
      );

      const isPropTypesDeclaration = binaryExpressions.find(
        (binaryExpression) => {
          if (
            binaryExpression.getOperatorToken().getKind() !==
            SyntaxKind.EqualsToken
          ) {
            return false;
          }

          const isPropTypes =
            binaryExpression
              .getLeft()
              .asKind(SyntaxKind.PropertyAccessExpression)
              .getName() === "propTypes";

          return isPropTypes;
        }
      );

      return !!isPropTypesDeclaration;
    });

  expressions.forEach((expression) => {
    const propTypesObject = expression
      .getFirstDescendantByKind(SyntaxKind.BinaryExpression)
      ?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);

    if (!propTypesObject) {
      return;
    }

    const componentName = expression
      .getFirstChildByKind(SyntaxKind.BinaryExpression)
      ?.getFirstChildByKind(SyntaxKind.PropertyAccessExpression)
      ?.getExpression()
      .getText();

    if (!componentName) {
      return;
    }

    const propTypesToTypes = propTypesObject
      .getChildrenOfKind(SyntaxKind.PropertyAssignment)
      .reduce<TypeDefinition>((result, property) => {
        const type = propTypeToType(property, propTypesImportName);

        return {
          ...result,
          [property.getName()]: type,
        };
      }, {});

    const componentNode =
      file.getFunction(componentName) ||
      file.getClass(componentName) ||
      file.getVariableStatement(componentName);

    if (!componentNode) {
      return;
    }

    const propsTypeAliasName = `${componentName}Props`;

    const addedTypeAlias = file.addTypeAlias({
      name: propsTypeAliasName,
      type: Writers.objectType({
        properties: Object.entries(propTypesToTypes).map(([name, type]) => {
          return {
            name,
            type,
          };
        }),
      }),
    });

    if (!addedTypeAlias) {
      return;
    }

    addedTypeAlias.setOrder(componentNode.getChildIndex());

    expression.remove();
  });

  file.formatText();
}

async function morph() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  morphFile(
    project.getSourceFileOrThrow("src/components/EventLogHistorySection.tsx")
  );

  // const sourcesFiles = project.getSourceFiles();

  // sourcesFiles.forEach(morphFile);

  await project.save();
}

morph();
