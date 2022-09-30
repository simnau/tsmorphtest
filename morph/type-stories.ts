import {
  CodeBlockWriter,
  ImportDeclaration,
  Project,
  SourceFile,
  SyntaxKind,
  ts,
  Node,
} from "ts-morph";

function getFilenameWithoutExtension(filename: string) {
  return filename.substring(0, filename.lastIndexOf("."));
}

function exportComponentProps(
  mainImport: ImportDeclaration,
  propsName: string
) {
  const mainSourceFile = mainImport.getModuleSpecifierSourceFile();

  const typeAlias =
    mainSourceFile.getTypeAlias(propsName) ||
    mainSourceFile.getInterfaceOrThrow(propsName);

  typeAlias.setIsExported(true);

  if (
    !mainImport
      .getNamedImports()
      .find((namedImport) => namedImport.getText() === propsName)
  ) {
    mainImport.addNamedImport(propsName);
  }
}

function renameFile(file: SourceFile) {
  const filename = getFilenameWithoutExtension(file.getBaseName());

  const jsxElement = !!(
    file.getFirstDescendantByKind(SyntaxKind.JsxElement) ||
    file.getFirstDescendantByKind(SyntaxKind.JsxSelfClosingElement)
  );
  const extension = jsxElement ? "tsx" : "ts";

  file.move(`${filename}.${extension}`);
}

function castDefaultExport(
  defaultExport: Node<ts.Node>,
  storyTypeName: string
) {
  let defaultExportText = defaultExport.getFullText();

  if (defaultExportText.endsWith(";")) {
    defaultExportText = defaultExportText.substring(
      0,
      defaultExportText.length - 1
    );
  }

  defaultExport
    .replaceWithText((writer: CodeBlockWriter) => {
      writer.writeLine(`
    ${defaultExportText} as Meta<${storyTypeName}>;
`);
    })
    .formatText();
}

async function morphFile(file: SourceFile) {
  const defaultExport = file.getDefaultExportSymbol().getDeclarations()[0];

  const componentName = defaultExport
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((propertyAssignment) => propertyAssignment.getName() === "component")
    .getInitializer()
    .getText();

  const mainImport = file.getImportDeclarationOrThrow((importDeclaration) => {
    const defaultImport = importDeclaration.getDefaultImport();

    if (!defaultImport) {
      return;
    }

    return defaultImport.getText() === componentName;
  });
  const mainImportName = mainImport.getDefaultImport().getText();
  const propsName = `${mainImportName}Props`;
  const storyTypeName = `${mainImportName}Story`;

  const defaultExportIndex = defaultExport.getChildIndex();

  exportComponentProps(mainImport, propsName);

  // put the new type alias above the default export
  file
    .addTypeAlias({
      name: storyTypeName,
      type: `Story<${propsName}>`,
    })
    .setOrder(defaultExportIndex)
    .prependWhitespace(() => "\n");

  castDefaultExport(defaultExport, storyTypeName);

  const variableDeclarations = file.getDescendantsOfKind(
    SyntaxKind.VariableDeclaration
  );

  const storyTemplate = variableDeclarations.find((variableDeclaration) => {
    const arrowFunction = variableDeclaration.getInitializerIfKind(
      SyntaxKind.ArrowFunction
    );

    if (!arrowFunction) {
      return false;
    }

    const jsxElement =
      arrowFunction.getFirstDescendantByKind(SyntaxKind.JsxElement) ||
      arrowFunction.getFirstDescendantByKind(SyntaxKind.JsxSelfClosingElement);

    return !!jsxElement;
  });

  if (!storyTemplate) {
    throw new Error(`Story template not found in file ${file.getBaseName()}`);
  }

  storyTemplate.setType(storyTypeName);

  const storyTemplateName = storyTemplate.getName();

  variableDeclarations
    .filter((declaration) => {
      const propertyAccessExpression = declaration
        .getInitializer()
        .getFirstDescendantByKind(SyntaxKind.PropertyAccessExpression);

      if (!propertyAccessExpression) {
        return false;
      }

      return (
        propertyAccessExpression.getExpression().getText() === storyTemplateName
      );
    })
    .forEach((declaration) => {
      declaration.setType(storyTypeName);
    });

  renameFile(file);

  file.addImportDeclaration({
    namedImports: ["Story", "Meta"],
    moduleSpecifier: "@storybook/react",
  });
}

async function morph() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const sourcesFiles = project.getSourceFiles();

  const storiesFiles = sourcesFiles.filter((sourceFile) => {
    const filename = sourceFile.getBaseName();

    return filename.endsWith("stories.jsx") || filename.endsWith("stories.js");
  });

  for (const file of storiesFiles) {
    await morphFile(file);
  }

  await project.save();
}

morph();
