# Closed-loop provenance v15

This manifest entry is for the closed-loop phase-controller DSO only. It must
not be confused with the rootchain regression artifact or its provenance.

```text
artifact=so/ghostlock_closed_loop.so
size=215856
sha256=6b1a84390dd81e7d820678b5bf1ed8e090314f21da80a6611ac7d1abcac4c5a9
elf_entry=0x2D538
manifest_version=15
execution=/system/bin/linker64
```

The ELF entry was read with llvm-readelf from the exact published artifact.
The rootchain bridge value `0x25950` belongs only to
`preload_rootchain_bridge.so` and is invalid for this DSO.
