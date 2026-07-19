<?php

declare(strict_types=1);

namespace App\Libraries;

use InvalidArgumentException;

/**
 * Self-contained QR Code generator (byte mode).
 *
 * A dependency-free PHP implementation of the QR Code specification supporting
 * versions 1–40, all four error-correction levels, Reed–Solomon error
 * correction and automatic mask selection. Renders to SVG (vector, scalable)
 * so no image extension is required — ideal for shared hosting.
 *
 * Algorithm follows the ISO/IEC 18004 standard.
 *
 * @package App\Libraries
 */
final class QrCode
{
    public const ECC_LOW      = 1;
    public const ECC_MEDIUM   = 0;
    public const ECC_QUARTILE = 3;
    public const ECC_HIGH     = 2;

    /** @var int[][] Final module matrix (1 = dark). */
    private array $modules = [];

    /** @var bool[][] Reserved function-pattern cells. */
    private array $isFunction = [];

    private int $size;

    private function __construct(private int $version, private int $eccLevel, private array $dataCodewords)
    {
        $this->size = $version * 4 + 17;
        for ($i = 0; $i < $this->size; $i++) {
            $this->modules[$i]    = array_fill(0, $this->size, 0);
            $this->isFunction[$i] = array_fill(0, $this->size, false);
        }
        $this->drawFunctionPatterns();
        $allCodewords = $this->addEccAndInterleave($dataCodewords);
        $this->drawCodewords($allCodewords);
        $mask = $this->selectMask();
        $this->applyMask($mask);
        $this->drawFormatBits($mask);
    }

    /**
     * Encode text and return an SVG string.
     */
    public static function svg(string $text, int $scale = 6, int $border = 4, int $ecc = self::ECC_MEDIUM, string $dark = '#000000', string $light = '#ffffff'): string
    {
        $qr = self::encodeText($text, $ecc);
        return $qr->toSvgString($scale, $border, $dark, $light);
    }

    /**
     * Return a data: URI (SVG) suitable for an <img src> attribute.
     */
    public static function dataUri(string $text, int $scale = 6, int $border = 4, int $ecc = self::ECC_MEDIUM): string
    {
        $svg = self::svg($text, $scale, $border, $ecc);
        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }

    /**
     * Build a QR code from a text string (UTF-8, byte mode).
     */
    public static function encodeText(string $text, int $ecc = self::ECC_MEDIUM): self
    {
        $bytes = array_values(unpack('C*', $text) ?: []);
        return self::encodeBytes($bytes, $ecc);
    }

    /**
     * Build a QR code from raw bytes.
     *
     * @param int[] $data
     */
    public static function encodeBytes(array $data, int $ecc = self::ECC_MEDIUM): self
    {
        // Build bit stream: mode (0100) + length + data.
        $bb = [];
        self::appendBits($bb, 0x4, 4); // Byte mode indicator.

        // Choose smallest version that fits.
        for ($version = 1; $version <= 40; $version++) {
            $capacityBits = self::numDataCodewords($version, $ecc) * 8;
            $charCountBits = $version < 10 ? 8 : 16;
            $usedBits = 4 + $charCountBits + count($data) * 8;
            if ($usedBits <= $capacityBits) {
                break;
            }
            if ($version === 40) {
                throw new InvalidArgumentException('Data too long for QR code.');
            }
        }

        $charCountBits = $version < 10 ? 8 : 16;
        self::appendBits($bb, count($data), $charCountBits);
        foreach ($data as $byte) {
            self::appendBits($bb, $byte, 8);
        }

        $dataCapacityBits = self::numDataCodewords($version, $ecc) * 8;

        // Terminator.
        $terminator = min(4, $dataCapacityBits - count($bb));
        self::appendBits($bb, 0, $terminator);
        // Pad to byte boundary.
        self::appendBits($bb, 0, (8 - count($bb) % 8) % 8);

        // Pad bytes.
        for ($pad = 0xEC; count($bb) < $dataCapacityBits; $pad ^= 0xEC ^ 0x11) {
            self::appendBits($bb, $pad, 8);
        }

        // Pack bits into codewords.
        $dataCodewords = array_fill(0, count($bb) >> 3, 0);
        foreach ($bb as $i => $bit) {
            $dataCodewords[$i >> 3] |= $bit << (7 - ($i & 7));
        }

        return new self($version, $ecc, $dataCodewords);
    }

    // ---------------------------------------------------------------
    //  Rendering
    // ---------------------------------------------------------------

    public function toSvgString(int $scale, int $border, string $dark, string $light): string
    {
        $dim   = ($this->size + $border * 2) * $scale;
        $parts = [];
        $parts[] = '<?xml version="1.0" encoding="UTF-8"?>';
        $parts[] = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $dim . '" height="' . $dim
            . '" viewBox="0 0 ' . $dim . ' ' . $dim . '" shape-rendering="crispEdges">';
        $parts[] = '<rect width="100%" height="100%" fill="' . $light . '"/>';
        $parts[] = '<path fill="' . $dark . '" d="';

        for ($y = 0; $y < $this->size; $y++) {
            for ($x = 0; $x < $this->size; $x++) {
                if ($this->modules[$y][$x] === 1) {
                    $px = ($x + $border) * $scale;
                    $py = ($y + $border) * $scale;
                    $parts[] = 'M' . $px . ',' . $py . 'h' . $scale . 'v' . $scale . 'h-' . $scale . 'z';
                }
            }
        }

        $parts[] = '"/></svg>';
        return implode('', $parts);
    }

    /**
     * @return int[][]
     */
    public function matrix(): array
    {
        return $this->modules;
    }

    // ---------------------------------------------------------------
    //  Function patterns
    // ---------------------------------------------------------------

    private function drawFunctionPatterns(): void
    {
        for ($i = 0; $i < $this->size; $i++) {
            $this->setFunctionModule(6, $i, $i % 2 === 0);
            $this->setFunctionModule($i, 6, $i % 2 === 0);
        }

        $this->drawFinderPattern(3, 3);
        $this->drawFinderPattern($this->size - 4, 3);
        $this->drawFinderPattern(3, $this->size - 4);

        $alignPositions = $this->alignmentPatternPositions();
        $numAlign       = count($alignPositions);
        for ($i = 0; $i < $numAlign; $i++) {
            for ($j = 0; $j < $numAlign; $j++) {
                if (($i === 0 && $j === 0) || ($i === 0 && $j === $numAlign - 1) || ($i === $numAlign - 1 && $j === 0)) {
                    continue;
                }
                $this->drawAlignmentPattern($alignPositions[$i], $alignPositions[$j]);
            }
        }

        $this->drawFormatBits(0);
        $this->drawVersion();
    }

    private function drawFinderPattern(int $cx, int $cy): void
    {
        for ($dy = -4; $dy <= 4; $dy++) {
            for ($dx = -4; $dx <= 4; $dx++) {
                $dist = max(abs($dx), abs($dy));
                $xx   = $cx + $dx;
                $yy   = $cy + $dy;
                if ($xx >= 0 && $xx < $this->size && $yy >= 0 && $yy < $this->size) {
                    $this->setFunctionModule($xx, $yy, $dist !== 2 && $dist !== 4);
                }
            }
        }
    }

    private function drawAlignmentPattern(int $cx, int $cy): void
    {
        for ($dy = -2; $dy <= 2; $dy++) {
            for ($dx = -2; $dx <= 2; $dx++) {
                $this->setFunctionModule($cx + $dx, $cy + $dy, max(abs($dx), abs($dy)) !== 1);
            }
        }
    }

    private function drawFormatBits(int $mask): void
    {
        $data = ($this->eccLevel << 3) | $mask;
        $rem  = $data;
        for ($i = 0; $i < 10; $i++) {
            $rem = ($rem << 1) ^ (($rem >> 9) * 0x537);
        }
        $bits = (($data << 10) | $rem) ^ 0x5412;

        for ($i = 0; $i <= 5; $i++) {
            $this->setFunctionModule(8, $i, $this->getBit($bits, $i));
        }
        $this->setFunctionModule(8, 7, $this->getBit($bits, 6));
        $this->setFunctionModule(8, 8, $this->getBit($bits, 7));
        $this->setFunctionModule(7, 8, $this->getBit($bits, 8));
        for ($i = 9; $i < 15; $i++) {
            $this->setFunctionModule(14 - $i, 8, $this->getBit($bits, $i));
        }

        for ($i = 0; $i < 8; $i++) {
            $this->setFunctionModule($this->size - 1 - $i, 8, $this->getBit($bits, $i));
        }
        for ($i = 8; $i < 15; $i++) {
            $this->setFunctionModule(8, $this->size - 15 + $i, $this->getBit($bits, $i));
        }
        $this->setFunctionModule(8, $this->size - 8, true);
    }

    private function drawVersion(): void
    {
        if ($this->version < 7) {
            return;
        }

        $rem = $this->version;
        for ($i = 0; $i < 12; $i++) {
            $rem = ($rem << 1) ^ (($rem >> 11) * 0x1F25);
        }
        $bits = ($this->version << 12) | $rem;

        for ($i = 0; $i < 18; $i++) {
            $bit = $this->getBit($bits, $i);
            $a   = $this->size - 11 + $i % 3;
            $b   = intdiv($i, 3);
            $this->setFunctionModule($a, $b, $bit);
            $this->setFunctionModule($b, $a, $bit);
        }
    }

    private function setFunctionModule(int $x, int $y, bool $isDark): void
    {
        $this->modules[$y][$x]    = $isDark ? 1 : 0;
        $this->isFunction[$y][$x] = true;
    }

    // ---------------------------------------------------------------
    //  Error correction & data placement
    // ---------------------------------------------------------------

    /**
     * @param int[] $data
     * @return int[]
     */
    private function addEccAndInterleave(array $data): array
    {
        $version   = $this->version;
        $ecl       = $this->eccLevel;
        $numBlocks = self::NUM_ERROR_CORRECTION_BLOCKS[$ecl][$version];
        $blockEccLen = self::ECC_CODEWORDS_PER_BLOCK[$ecl][$version];
        $rawCodewords = intdiv(self::getNumRawDataModules($version), 8);
        $numShortBlocks = $numBlocks - $rawCodewords % $numBlocks;
        $shortBlockLen  = intdiv($rawCodewords, $numBlocks);

        $blocks    = [];
        $rsDiv     = $this->reedSolomonComputeDivisor($blockEccLen);
        $k         = 0;
        for ($i = 0; $i < $numBlocks; $i++) {
            $datLen = $shortBlockLen - $blockEccLen + ($i < $numShortBlocks ? 0 : 1);
            $dat    = array_slice($data, $k, $datLen);
            $k     += $datLen;
            $ecc    = $this->reedSolomonComputeRemainder($dat, $rsDiv);
            if ($i < $numShortBlocks) {
                $dat[] = 0; // Placeholder to align interleaving.
            }
            $blocks[] = array_merge($dat, $ecc);
        }

        $result = [];
        $maxLen = count($blocks[count($blocks) - 1]);
        for ($i = 0; $i < $maxLen; $i++) {
            foreach ($blocks as $j => $block) {
                // Skip the placeholder padding column in short blocks.
                if ($i !== $shortBlockLen - $blockEccLen || $j >= $numShortBlocks) {
                    $result[] = $block[$i];
                }
            }
        }

        return $result;
    }

    /**
     * @param int[] $allCodewords
     */
    private function drawCodewords(array $allCodewords): void
    {
        $i = 0;
        $bitLen = count($allCodewords) * 8;

        for ($right = $this->size - 1; $right >= 1; $right -= 2) {
            if ($right === 6) {
                $right = 5;
            }
            for ($vert = 0; $vert < $this->size; $vert++) {
                for ($j = 0; $j < 2; $j++) {
                    $x       = $right - $j;
                    $upward  = (($right + 1) & 2) === 0;
                    $y       = $upward ? $this->size - 1 - $vert : $vert;
                    if (!$this->isFunction[$y][$x] && $i < $bitLen) {
                        $this->modules[$y][$x] = $this->getBit($allCodewords[$i >> 3], 7 - ($i & 7)) ? 1 : 0;
                        $i++;
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------
    //  Masking
    // ---------------------------------------------------------------

    private function selectMask(): int
    {
        $minPenalty = PHP_INT_MAX;
        $bestMask   = 0;
        for ($mask = 0; $mask < 8; $mask++) {
            $this->applyMask($mask);
            $this->drawFormatBits($mask);
            $penalty = $this->penaltyScore();
            if ($penalty < $minPenalty) {
                $minPenalty = $penalty;
                $bestMask   = $mask;
            }
            $this->applyMask($mask); // Undo (XOR is its own inverse).
        }
        return $bestMask;
    }

    private function applyMask(int $mask): void
    {
        for ($y = 0; $y < $this->size; $y++) {
            for ($x = 0; $x < $this->size; $x++) {
                if ($this->isFunction[$y][$x]) {
                    continue;
                }
                $invert = match ($mask) {
                    0 => ($x + $y) % 2 === 0,
                    1 => $y % 2 === 0,
                    2 => $x % 3 === 0,
                    3 => ($x + $y) % 3 === 0,
                    4 => (intdiv($x, 3) + intdiv($y, 2)) % 2 === 0,
                    5 => ($x * $y) % 2 + ($x * $y) % 3 === 0,
                    6 => (($x * $y) % 2 + ($x * $y) % 3) % 2 === 0,
                    7 => (($x + $y) % 2 + ($x * $y) % 3) % 2 === 0,
                    default => false,
                };
                if ($invert) {
                    $this->modules[$y][$x] ^= 1;
                }
            }
        }
    }

    private function penaltyScore(): int
    {
        $result = 0;
        $size   = $this->size;

        // Adjacent modules in row/column with same colour.
        for ($y = 0; $y < $size; $y++) {
            $runColor = 0;
            $runX     = 0;
            for ($x = 0; $x < $size; $x++) {
                if ($this->modules[$y][$x] === $runColor) {
                    $runX++;
                    if ($runX === 5) {
                        $result += 3;
                    } elseif ($runX > 5) {
                        $result++;
                    }
                } else {
                    $runColor = $this->modules[$y][$x];
                    $runX     = 1;
                }
            }
        }
        for ($x = 0; $x < $size; $x++) {
            $runColor = 0;
            $runY     = 0;
            for ($y = 0; $y < $size; $y++) {
                if ($this->modules[$y][$x] === $runColor) {
                    $runY++;
                    if ($runY === 5) {
                        $result += 3;
                    } elseif ($runY > 5) {
                        $result++;
                    }
                } else {
                    $runColor = $this->modules[$y][$x];
                    $runY     = 1;
                }
            }
        }

        // 2x2 blocks of same colour.
        for ($y = 0; $y < $size - 1; $y++) {
            for ($x = 0; $x < $size - 1; $x++) {
                $c = $this->modules[$y][$x];
                if ($c === $this->modules[$y][$x + 1] && $c === $this->modules[$y + 1][$x] && $c === $this->modules[$y + 1][$x + 1]) {
                    $result += 3;
                }
            }
        }

        // Dark/light balance.
        $dark = 0;
        for ($y = 0; $y < $size; $y++) {
            $dark += array_sum($this->modules[$y]);
        }
        $total = $size * $size;
        $k     = (int) (abs($dark * 20 - $total * 10) / $total);
        $result += $k * 10;

        return $result;
    }

    // ---------------------------------------------------------------
    //  Reed–Solomon
    // ---------------------------------------------------------------

    /**
     * @return int[]
     */
    private function reedSolomonComputeDivisor(int $degree): array
    {
        $result = array_fill(0, $degree, 0);
        $result[$degree - 1] = 1;
        $root = 1;
        for ($i = 0; $i < $degree; $i++) {
            for ($j = 0; $j < $degree; $j++) {
                $result[$j] = $this->reedSolomonMultiply($result[$j], $root);
                if ($j + 1 < $degree) {
                    $result[$j] ^= $result[$j + 1];
                }
            }
            $root = $this->reedSolomonMultiply($root, 0x02);
        }
        return $result;
    }

    /**
     * @param int[] $data
     * @param int[] $divisor
     * @return int[]
     */
    private function reedSolomonComputeRemainder(array $data, array $divisor): array
    {
        $result = array_fill(0, count($divisor), 0);
        foreach ($data as $b) {
            $factor = $b ^ $result[0];
            array_shift($result);
            $result[] = 0;
            foreach ($divisor as $i => $coef) {
                $result[$i] ^= $this->reedSolomonMultiply($coef, $factor);
            }
        }
        return $result;
    }

    private function reedSolomonMultiply(int $x, int $y): int
    {
        $z = 0;
        for ($i = 7; $i >= 0; $i--) {
            $z = ($z << 1) ^ (($z >> 7) * 0x11D);
            $z ^= (($y >> $i) & 1) * $x;
        }
        return $z & 0xFF;
    }

    // ---------------------------------------------------------------
    //  Numeric helpers & tables
    // ---------------------------------------------------------------

    /**
     * @return int[]
     */
    private function alignmentPatternPositions(): array
    {
        if ($this->version === 1) {
            return [];
        }
        $numAlign = intdiv($this->version, 7) + 2;
        $step     = intdiv($this->version * 8 + intdiv($numAlign * 4, 2) + 1, $numAlign * 2 - 2) * 2;
        $result   = [6];
        for ($pos = $this->size - 7; count($result) < $numAlign; $pos -= $step) {
            array_splice($result, 1, 0, [$pos]);
        }
        return $result;
    }

    private static function getNumRawDataModules(int $version): int
    {
        $result = (16 * $version + 128) * $version + 64;
        if ($version >= 2) {
            $numAlign = intdiv($version, 7) + 2;
            $result  -= (25 * $numAlign - 10) * $numAlign - 55;
            if ($version >= 7) {
                $result -= 36;
            }
        }
        return $result;
    }

    private static function numDataCodewords(int $version, int $ecl): int
    {
        return intdiv(self::getNumRawDataModules($version), 8)
            - self::ECC_CODEWORDS_PER_BLOCK[$ecl][$version]
            * self::NUM_ERROR_CORRECTION_BLOCKS[$ecl][$version];
    }

    /**
     * @param int[] $bb
     */
    private static function appendBits(array &$bb, int $value, int $length): void
    {
        for ($i = $length - 1; $i >= 0; $i--) {
            $bb[] = ($value >> $i) & 1;
        }
    }

    private function getBit(int $value, int $index): bool
    {
        return (($value >> $index) & 1) !== 0;
    }

    /** ECC codewords per block, indexed [ecl][version]. Index 0 unused. */
    private const ECC_CODEWORDS_PER_BLOCK = [
        // Medium
        [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
        // Low
        [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        // High
        [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        // Quartile
        [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    ];

    /** Number of ECC blocks, indexed [ecl][version]. Index 0 unused. */
    private const NUM_ERROR_CORRECTION_BLOCKS = [
        // Medium
        [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
        // Low
        [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
        // High
        [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
        // Quartile
        [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    ];
}
