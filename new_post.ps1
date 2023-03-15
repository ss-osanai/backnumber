param(
    [int]$start,
    [int]$end
)

for ($i = $start; $i -le $end; $i++) {
    # Write-Output $i
    hugo new post/$i.md
}