// 重回帰分析 (multiple linear regression) via ordinary least squares.
// Implemented from scratch with normal equations to avoid extra dependencies.

export interface RegressionResult {
  featureNames: string[]; // includes "切片" (intercept) at index 0
  coefficients: number[];
  stdErrors: number[];
  tValues: number[];
  significant: boolean[]; // |t| >= 2 as a rough indicative threshold
  r2: number;
  adjR2: number;
  n: number;
  predictions: number[];
  residuals: number[];
}

function transpose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const out: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) out[j][i] = m[i][j];
  }
  return out;
}

function matmul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0].length;
  const out: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < cols; j++) {
        out[i][j] += aik * b[k][j];
      }
    }
  }
  return out;
}

function matVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((sum, val, i) => sum + val * v[i], 0));
}

// Gauss-Jordan inversion. Throws if matrix is (near) singular.
function invert(matrix: number[][]): number[][] {
  const n = matrix.length;
  const aug: number[][] = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > maxAbs) {
        maxAbs = Math.abs(aug[r][col]);
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-10) {
      throw new Error(
        "この条件では計算できません(データ不足、または説明変数どうしの相関が強すぎます)"
      );
    }
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
    }
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

export function runOLS(
  X: number[][],
  y: number[],
  featureNames: string[]
): RegressionResult {
  const n = X.length;
  const k = featureNames.length; // includes intercept
  if (n <= k) {
    throw new Error(
      `データが不足しています(サンプル数 ${n}、必要な説明変数 ${k - 1} 個 + 切片)。もっとデータを入力するか、説明変数を減らしてください。`
    );
  }

  const Xt = transpose(X);
  const XtX = matmul(Xt, X);
  const XtXInv = invert(XtX);
  const XtY = Xt.map((row) => row.reduce((sum, val, i) => sum + val * y[i], 0));
  const beta = matVec(XtXInv, XtY);

  const predictions = X.map((row) => row.reduce((sum, val, i) => sum + val * beta[i], 0));
  const residuals = y.map((yi, i) => yi - predictions[i]);
  const rss = residuals.reduce((sum, r) => sum + r * r, 0);
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const tss = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const r2 = tss > 0 ? 1 - rss / tss : 1;
  const df = n - k;
  const adjR2 = tss > 0 && df > 0 ? 1 - (1 - r2) * (n - 1) / df : r2;
  const sigma2 = df > 0 ? rss / df : 0;

  const stdErrors = beta.map((_, i) => Math.sqrt(Math.max(sigma2 * XtXInv[i][i], 0)));
  const tValues = beta.map((b, i) => (stdErrors[i] > 0 ? b / stdErrors[i] : 0));
  const significant = tValues.map((t) => Math.abs(t) >= 2);

  return {
    featureNames,
    coefficients: beta,
    stdErrors,
    tValues,
    significant,
    r2,
    adjR2,
    n,
    predictions,
    residuals,
  };
}

export function predict(result: RegressionResult, features: number[]): number {
  // features must exclude intercept; a leading 1 is added automatically.
  const row = [1, ...features];
  return row.reduce((sum, val, i) => sum + val * result.coefficients[i], 0);
}
