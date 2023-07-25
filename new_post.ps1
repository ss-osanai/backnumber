<#
    .SYNOPSIS
        Hugo の記事ファイルを連番で作成します。
        
        $ .\new_post.ps1 7061 7070

        で、content/post ディレクトリに 7061.md から 7070.md までのファイルを作成します。
#>
param(
    [int]$start,
    [int]$end
)

for ($i = $start; $i -le $end; $i++) {
    # Write-Output $i
    hugo new post/$i.md
    Start-Sleep -Seconds 1.5
}