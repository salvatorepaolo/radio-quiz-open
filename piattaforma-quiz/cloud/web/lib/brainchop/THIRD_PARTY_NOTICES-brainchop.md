# Third-party notices

## Connected-component labeling

niimath's `bwlabel.c` is Jesper Andersson's BSD-2-Clause port of
`spm_bwlabel.c`. This repository does **not** contain that implementation:
`src/bwlabel.c` is an independent queue-based flood-fill implementation
covering both 26-connected largest-component retention (`bwlabel_largest`) and
class-aware 6-connected hierarchical cleanup with neighbor relabeling
(`bwlabel_cleanup18`, `bwlabel_cleanup104`). The Andersson notice is therefore
not required for the current file. It must be restored if niimath's
implementation is copied back in later.

## NIfTI I/O

`src/nifti_io.c` and `src/nifti_io.h` are the separately managed public-domain
NIfTI I/O consolidation based on work by Robert W. Cox, Mark Jenkinson, Rick
Reynolds, and Chris Rorden.

## niimath

Copyright (c) 2020, Chris Rorden's Lab. BSD-2-Clause:
<https://github.com/rordenlab/niimath>. The project's own license is MIT, which
permits including BSD-2-Clause material provided the notice travels with it --
this section is that notice, and the derivations it covers are deliberate rather
than incidental.

Two files carry work derived from niimath:

- **`src/preprocess.c`** -- the Felzenszwalb/Huttenlocher exact Euclidean
  distance transform behind `--border`. `intersection()` and `edt_line()` are a
  port of niimath's `vx()` and `edt()` in `src/coreFLT.c`: the same lower-
  envelope-of-parabolas algorithm, the same `INFINITY`/`isnan` handling of a
  degenerate intersection, and the same 1/delta^2 prescale. Renamed and reduced
  to a single float precision; the structure is niimath's.
- **`src/conform.c`** -- `scale_intensity()` reproduces niimath conform's
  training-intensity transform (reduced to the fixed 0..255, f_low=0, f_high=.98
  case MindGrab needs), `comply_scale()` its `-comply` clamp, and
  `brainchopc_reslice()` matches niimath's reference-grid reslice, including its
  use of the sform for both images and its preservation of the target header's
  stored voxel sizes. Those choices are load-bearing for bit-exactness against
  the Python reference, not stylistic.

`src/nifti_io.c` and `src/nifti_io.h` also came by way of niimath, but they are
the public-domain NIfTI I/O consolidation noticed above, not BSD-2-Clause
material.

`src/bwlabel.c` is NOT derived from niimath; see the first section.

BSD 2-Clause License

Copyright (c) 2020, Chris Rorden's Lab
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## winpthreads (Windows executables)

```text
Copyright (c) 2011 mingw-w64 project

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.


/*
 * Parts of this library are derived by:
 *
 * Posix Threads library for Microsoft Windows
 *
 * Use at own risk, there is no implied warranty to this code.
 * It uses undocumented features of Microsoft Windows that can change
 * at any time in the future.
 *
 * (C) 2010 Lockless Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 *
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *  * Neither the name of Lockless Inc. nor the names of its contributors may be
 *    used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AN
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 */
```

## LLVM OpenMP runtime (no longer applicable)

Nothing in this project links an OpenMP runtime any more, so there is no LLVM
notice to give. Multithreading is a pthread pool (`src/bc_threads.c`) over
libSystem on macOS and libc on Linux, which add no obligation here. Windows
builds (`WINDOWS_STATIC=1`, the default: release archives and PyPI builds)
statically link MSYS2's libwinpthread, whose notice follows.

Kept as a heading rather than deleted because releases up to and including the
OpenMP era DID ship LLVM code: macOS executables statically linked libomp built
from the LLVM 20.1.8 source release, under the Apache License 2.0 with LLVM
Exceptions, and earlier releases bundled `libomp.dylib` beside the executable.
Anyone auditing one of those binaries still needs that notice; anyone auditing a
current one does not.

## BrainChop and MindGrab

The command behavior is compatible with the MIT-licensed brainchop-cli project
by Mike Doan (2024): <https://github.com/neuroneural/brainchop-cli>.

The MindGrab weights were obtained from the upstream model release, whose
model-card metadata declares the artifact MIT licensed. Reference checkpoint:
<https://huggingface.co/neuroneural/mindgrab/resolve/main/model.pth>.

All four models' weights were created by Sergey Plis (2026) and are MIT
licensed: MindGrab (`mindgrab`), `mindmap` (MindMap-18 v4.0 Gold, PR #37, from
`model24chan18cls_gdice_prio`), and `mindsnap` (MindSnap-104 v4.0 Gold, PR #37,
from `model24chan104cls_v3_repbn`) are taken from
<https://github.com/neuroneural/brainchop-test> (`public/models/`, `webgpu`
branch), and `model16chan18cls` (`mindmap-fast`) ships the locked MindMap-16
v4.1 (`A35C35D30`) checkpoint (replacing v3.5). Files derived from them here
(the Metal headers, the CUDA and HIP modules) carry the same licence.

MIT License

Copyright (c) 2024 spikedoanz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Test image `test/t1_2mm.nii.gz`

`test/t1_2mm.nii.gz` is redistributed from the BSD-2-Clause licensed
`dcm_qa_xa30` DICOM validation dataset by Chris Rorden:
<https://github.com/neurolabusc/dcm_qa_xa30>. It is included as a regression
fixture: unlike `test/t1_crop.nii.gz`, which is already 256^3 at 1 mm, it is a
real 96x128x128 2 mm INT16 acquisition, so the conform and inverse-reslice paths
and the input-datatype restore have real work to do.

BSD 2-Clause License

Copyright (c) Chris Rorden

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## WGSL convolution structure (TensorFlow.js)

`src/webgpu_kernels.h` contains WGSL compute kernels written for this project.
The convolution deliberately follows the structure of TensorFlow.js's WebGPU
Conv3D — `tfjs-backend-webgpu/src/conv3d_naive_webgpu.ts` — specifically its
workgroup size of 64, its bounds-checked handling of padding and dilation, and
its accumulation of the input-channel reduction as `vec4` dot products. The same
file is vendored by onnxruntime-web at
`js/web/lib/wasm/jsep/webgpu/ops/3rd-party/conv3d_naive_webgpu.ts`.

No TypeScript was copied: the kernels here are WGSL emitted from C, specialised
to a fixed 3×3×3 kernel and a 16-wide channel stride, and they compute all
output channels of a voxel in one invocation rather than one channel per
invocation. The debt is to the approach, and it is recorded because the approach
is the valuable part.

    Copyright 2023 Google LLC.
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

## tinygrad-generated Metal programs

`src/metal_mindgrab_generated.h` and `src/metal_model16_generated.h` contain
Metal kernels and dispatch plans generated by the MIT-licensed tinygrad
compiler. `scripts/export_tinygrad_metal.py` is the development-time generator;
tinygrad is not linked or distributed as a runtime dependency.

Copyright (c) 2024, the tiny corp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
