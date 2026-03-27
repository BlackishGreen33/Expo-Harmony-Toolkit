cmake_minimum_required(VERSION 3.11)
project(rnapp)

set(RNOH_APP_DIR "${CMAKE_CURRENT_SOURCE_DIR}")
set(RNOH_CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../oh_modules/@rnoh/react-native-openharmony/src/main/cpp")
if(NOT EXISTS "${RNOH_CPP_DIR}/CMakeLists.txt")
  file(GLOB RNOH_CPP_DIR_CANDIDATES
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../../oh_modules/.ohpm/@rnoh+react-native-openharmony@*/oh_modules/@rnoh/react-native-openharmony/src/main/cpp"
  )

  list(LENGTH RNOH_CPP_DIR_CANDIDATES RNOH_CPP_DIR_CANDIDATE_COUNT)
  if(RNOH_CPP_DIR_CANDIDATE_COUNT GREATER 0)
    list(GET RNOH_CPP_DIR_CANDIDATES 0 RNOH_CPP_DIR)
  endif()
endif()

if(NOT EXISTS "${RNOH_CPP_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "Unable to locate RNOH C++ sources under oh_modules or oh_modules/.ohpm. Re-sync Harmony dependencies before building.")
endif()

set(RNOH_GENERATED_DIR "${CMAKE_CURRENT_SOURCE_DIR}/generated")
set(OH_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../oh_modules")
set(CMAKE_ASM_FLAGS "-Wno-error=unused-command-line-argument -Qunused-arguments")
set(CMAKE_CXX_FLAGS "-fstack-protector-strong -Wl,-z,relro,-z,now,-z,noexecstack -s -fPIE -pie")

add_subdirectory("${RNOH_CPP_DIR}" ./rn)
include("${CMAKE_CURRENT_SOURCE_DIR}/autolinking.cmake")

if(DEFINED CMAKE_SYSROOT)
  set(RNOH_FORCE_ASSERT_INCLUDE "-include${CMAKE_SYSROOT}/usr/include/assert.h")
  add_compile_options("${RNOH_FORCE_ASSERT_INCLUDE}")

  foreach(RNOH_TARGET rnoh_core rnoh_core_package)
    if(TARGET ${RNOH_TARGET})
      # RNOH exposes a header named "assert.h" under its public include paths.
      # Force the SDK assert header into every compiled RNOH target first so
      # libc++ <cassert> never resolves to RNOH/assert.h during native builds.
      target_compile_options(${RNOH_TARGET} PRIVATE "${RNOH_FORCE_ASSERT_INCLUDE}")
    endif()
  endforeach()
endif()

file(GLOB GENERATED_CPP_FILES "${CMAKE_CURRENT_SOURCE_DIR}/generated/*.cpp")
add_library(rnoh_app SHARED
  ${GENERATED_CPP_FILES}
  "./PackageProvider.cpp"
  "${RNOH_CPP_DIR}/RNOHAppNapiBridge.cpp"
)

if(DEFINED CMAKE_SYSROOT)
  target_compile_options(rnoh_app PRIVATE "${RNOH_FORCE_ASSERT_INCLUDE}")
endif()

target_link_libraries(rnoh_app PUBLIC rnoh)
autolink_libraries(rnoh_app)
