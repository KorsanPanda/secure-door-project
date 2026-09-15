#pragma once

// Gizli/cihaza ozel ayarlar config.local.h icinde tutulur. Bu dosya yalnizca
// guvenli yonlendiricidir ve repoda kalabilir.
#if __has_include("config.local.h")
#include "config.local.h"
#else
#include "config.local.example.h"
#endif
