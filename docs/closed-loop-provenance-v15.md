# Closed-loop provenance v15

This manifest entry is for the closed-loop phase-controller DSO only. It must
not be confused with the rootchain regression artifact or its provenance.

```text
artifact=so/ghostlock_closed_loop.so
size=215000
sha256=0861be0175fc323e8faf01cfe6b218b4f25d537eeddd714ceaf80fe5ed1dd702
elf_entry=0x2D3C8
manifest_version=15
execution=/system/bin/linker64
```

The ELF entry was read with llvm-readelf from the exact published artifact.
The rootchain bridge value `0x25950` belongs only to
`preload_rootchain_bridge.so` and is invalid for this DSO.
