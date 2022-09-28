import { Project, SourceFile } from "ts-morph";

const getFileExtension = (filename: string) => {
  return filename.substring(filename.lastIndexOf(".") + 1);
};

const getFilenameWithoutExtension = (filename: string) => {
  return filename.substring(0, filename.lastIndexOf("."));
};

async function morphFile(file: SourceFile) {
  const originalFileName = file.getBaseName();
  const extension = getFileExtension(originalFileName);
  const filename = getFilenameWithoutExtension(originalFileName);

  if (extension === "js") {
    await file.moveImmediately(`${filename}.ts`);
  } else if (extension === "jsx") {
    await file.moveImmediately(`${filename}.tsx`);
  }
}

async function revertRename(file: SourceFile, originalFilename: string) {
  await file.moveImmediately(originalFilename);
}

async function morph() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const initialDiagnostics = project.getPreEmitDiagnostics();

  const sourcesFiles = project.getSourceFiles();

  const jsFiles = sourcesFiles.filter((sourceFile) => {
    const extension = getFileExtension(sourceFile.getBaseName());
    return extension === "js" || extension === "jsx";
  });

  for (const file of jsFiles) {
    const originalFileName = file.getBaseName();

    await morphFile(file);

    const updatedProject = new Project({
      tsConfigFilePath: "./tsconfig.json",
    });

    const updatedDiagnostics = updatedProject.getPreEmitDiagnostics();

    if (initialDiagnostics.length < updatedDiagnostics.length) {
      await revertRename(file, originalFileName);
    }
  }

  await project.save();
}

morph();
