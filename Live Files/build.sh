#!/bin/bash

# Live-SYS-ShopSystem Build Script
# Simple wrapper for the main build system

echo "🚀 Live-SYS-ShopSystem Build Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -d "modules" ] || [ ! -d "build" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Expected: modules/ and build/ directories"
    exit 1
fi

# Change to build directory and run the build
cd build

echo "📂 Changed to build directory"
echo "🔨 Starting build process..."
echo ""

# Pass all arguments to the build script
node build.js "$@"

BUILD_EXIT_CODE=$?

echo ""
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📄 Output file: Live-SYS-ShopSystem-Built.js"
    echo "🚀 Ready for Roll20 deployment!"
else
    echo "❌ Build failed with exit code $BUILD_EXIT_CODE"
    exit $BUILD_EXIT_CODE
fi