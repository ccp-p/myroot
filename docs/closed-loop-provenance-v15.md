# Closed-loop provenance v15

This manifest entry is for the closed-loop phase-controller DSO only. It must
not be confused with the rootchain regression artifact or its provenance.

```text
artifact=so/ghostlock_closed_loop.so
size=214648
sha256=a544e5655e9cc5b461c513f00fd794baeb5e63981ad67cbb8321ec2537249966
elf_entry=0x2D25C
manifest_version=15
execution=/system/bin/linker64
```

The ELF entry was read with llvm-readelf from the exact published artifact.
The rootchain bridge value `0x25950` belongs only to
`preload_rootchain_bridge.so` and is invalid for this DSO.
