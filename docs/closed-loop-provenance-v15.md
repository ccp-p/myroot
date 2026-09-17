# Closed-loop provenance v15

This manifest entry is for the closed-loop phase-controller DSO only. It must
not be confused with the rootchain regression artifact or its provenance.

```text
artifact=so/ghostlock_closed_loop.so
size=212384
sha256=e2704edc1cfc1a05987226327674fd2ca542602f79800c9873c97f560576aaa5
elf_entry=0x2CA14
manifest_version=15
execution=/system/bin/linker64
```

The ELF entry was read with llvm-readelf from the exact published artifact.
The rootchain bridge value `0x25950` belongs only to
`preload_rootchain_bridge.so` and is invalid for this DSO.
