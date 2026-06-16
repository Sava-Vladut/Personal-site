from __future__ import annotations

import argparse
import os
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from PIL import Image
from pillow_heif import register_heif_opener


INPUT_DIR = Path("heic")
OUTPUT_DIR = Path("png")
SUPPORTED_EXTENSIONS = {".heic", ".heif"}


@dataclass(frozen=True)
class ConversionTask:
    source_path: Path
    destination: Path


@dataclass(frozen=True)
class ConversionResult:
    source_name: str
    destination_name: str
    success: bool
    error: str | None = None


def iter_heic_files(folder: Path) -> list[Path]:
    return sorted(
        file_path
        for file_path in folder.iterdir()
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert HEIC/HEIF images to PNG.")
    parser.add_argument(
        "--workers",
        type=positive_int,
        help="Number of worker processes to use. Defaults to CPU count capped by input files.",
    )
    return parser.parse_args(argv)


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("workers must be at least 1")
    return parsed


def get_output_path(source_path: Path, reserved_names: set[str]) -> Path:
    destination = OUTPUT_DIR / f"{source_path.stem}.png"
    counter = 1

    while destination.name.lower() in reserved_names:
        destination = OUTPUT_DIR / f"{source_path.stem}_{counter}.png"
        counter += 1

    reserved_names.add(destination.name.lower())
    return destination


def build_conversion_tasks(source_paths: list[Path]) -> list[ConversionTask]:
    reserved_names = {
        output_path.name.lower()
        for output_path in OUTPUT_DIR.iterdir()
        if output_path.is_file()
    }
    return [
        ConversionTask(
            source_path=source_path,
            destination=get_output_path(source_path, reserved_names),
        )
        for source_path in source_paths
    ]


def init_worker() -> None:
    register_heif_opener()


def convert_file(source_path: Path, destination: Path) -> Path:
    with Image.open(source_path) as image:
        image.load()

        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

        image.save(destination, format="PNG")

    return destination


def convert_task(task: ConversionTask) -> ConversionResult:
    try:
        destination = convert_file(task.source_path, task.destination)
    except Exception as exc:  # noqa: BLE001
        return ConversionResult(
            source_name=task.source_path.name,
            destination_name=task.destination.name,
            success=False,
            error=str(exc),
        )

    return ConversionResult(
        source_name=task.source_path.name,
        destination_name=destination.name,
        success=True,
    )


def resolve_worker_count(requested_workers: int | None, task_count: int) -> int:
    if task_count == 0:
        return 1

    if requested_workers is not None:
        return min(requested_workers, task_count)

    detected_cpus = os.cpu_count() or 1
    return min(detected_cpus, task_count)


def run_conversions(tasks: list[ConversionTask], workers: int) -> list[ConversionResult]:
    if workers == 1:
        return [convert_task(task) for task in tasks]

    results: list[ConversionResult] = []
    with ProcessPoolExecutor(max_workers=workers, initializer=init_worker) as executor:
        future_to_task = {
            executor.submit(convert_task, task): task
            for task in tasks
        }
        for future in as_completed(future_to_task):
            task = future_to_task[future]
            try:
                results.append(future.result())
            except Exception as exc:  # noqa: BLE001
                results.append(
                    ConversionResult(
                        source_name=task.source_path.name,
                        destination_name=task.destination.name,
                        success=False,
                        error=f"Worker failed: {exc}",
                    )
                )

    return results


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    register_heif_opener()
    INPUT_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    heic_files = iter_heic_files(INPUT_DIR)
    if not heic_files:
        print(f"No HEIC files found in '{INPUT_DIR}'.")
        return 0

    tasks = build_conversion_tasks(heic_files)
    workers = resolve_worker_count(args.workers, len(tasks))

    converted = 0
    failed = 0

    for result in run_conversions(tasks, workers):
        if result.success:
            converted += 1
            print(f"Converted: {result.source_name} -> {result.destination_name}")
        else:
            failed += 1
            print(f"Failed: {result.source_name} ({result.error})", file=sys.stderr)

    print()
    print(f"Finished. Converted: {converted}, Failed: {failed}")
    print(f"Output folder: {OUTPUT_DIR.resolve()}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
