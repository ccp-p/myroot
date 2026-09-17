# Closed-loop provenance v15

This manifest entry is for the closed-loop phase-controller DSO only. It must
not be confused with the rootchain regression artifact or its provenance.

```text
artifact=so/ghostlock_closed_loop.so
size=212088
sha256=9df6623e2dec606f74f10fc76e8f69e5206ca0ccc9306410ad351c7fe3e442d6
elf_entry=0x2C930
manifest_version=15
execution=/system/bin/linker64
```

The ELF entry was read with llvm-readelf from the exact published artifact.
The rootchain bridge value `0x25950` belongs only to
`preload_rootchain_bridge.so` and is invalid for this DSO.
