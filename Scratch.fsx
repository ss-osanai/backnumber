open System.IO

// raw/ 以下に 2003/, 2004/ などのディレクトリがあるとして、
// それぞれのディレクトリにある、拡張子が *.md のファイル数を数える。
// ただし `_index.md` は除外する。

let directory = "content/raw/"
// let directory = "content/raw/2003/"

let countMarkdownFiles (directory: string) =
    let subDirFiles =
        Directory.GetDirectories(directory)
        |> Array.collect (fun dir -> Directory.GetFiles(dir, "*.md"))

    let rootDirFiles = Directory.GetFiles(directory, "*.md")

    Array.append subDirFiles rootDirFiles
    |> Array.filter (fun file -> Path.GetFileName(file) <> "_index.md")
    |> Array.length

countMarkdownFiles directory

printfn "Total markdown files (excluding _index.md): %d"
<| countMarkdownFiles directory
