import ast

P_FIELD = 251
NV = 7
NO = 50
N = NV + NO  # 57
M = NO       # 50

def modinv(a, p):
    return pow(int(a) % p, p - 2, p)

def mat_inv_gf(M_mat, p):
    n = len(M_mat)
    aug = [list(row) + [1 if j == i else 0 for j in range(n)] for i, row in enumerate(M_mat)]
    for col in range(n):
        pivot = None
        for row in range(col, n):
            if aug[row][col] % p != 0:
                pivot = row
                break
        if pivot is None:
            raise ValueError("Matrix is singular at col", col)
        aug[col], aug[pivot] = aug[pivot], aug[col]
        inv_pivot = modinv(aug[col][col], p)
        aug[col] = [(x * inv_pivot) % p for x in aug[col]]
        for row in range(n):
            if row != col and aug[row][col] % p != 0:
                factor = aug[row][col] % p
                aug[row] = [(aug[row][k] - factor * aug[col][k]) % p for k in range(2 * n)]
    return [row[n:] for row in aug]

def evaluate_polynomial(coeffs, vars_values):
    val = coeffs[0]
    for i in range(N):
        val = (val + coeffs[1 + i] * vars_values[i]) % P_FIELD
    idx = 1 + N
    for i in range(N):
        for j in range(i, N):
            val = (val + coeffs[idx] * vars_values[i] * vars_values[j]) % P_FIELD
            idx += 1
    return val

# Load data
with open('/home/hakatashi/Documents/GitHub/agent-playgrounds/ctf/tsg-decathlon-ctf-2026-crypto/dist/hidden_structure/output.txt') as f:
    content = f.read()

data = {}
for line in content.strip().split('\n'):
    key, val = line.split(' = ', 1)
    data[key.strip()] = ast.literal_eval(val.strip())

P_coeffs = data['P_coeffs']
Y = data['Y']

print(f"P_coeffs: {len(P_coeffs)} polynomials, {len(P_coeffs[0])} coeffs each")
print(f"Y: {len(Y)} values")

# Step 1: Extract B matrix: B[i][k] = linear coeff of o_k in p_i
# o_k = x_{NV+k}, linear index = 1 + NV + k = 8 + k
B = [[P_coeffs[i][1 + NV + k] for k in range(NO)] for i in range(M)]

print("Computing B inverse...")
C = mat_inv_gf(B, P_FIELD)
print("Done.")

# Verify C*B = I
check = [[sum(C[i][k] * B[k][j] for k in range(M)) % P_FIELD for j in range(M)] for i in range(M)]
ok = all(check[i][j] == (1 if i == j else 0) for i in range(M) for j in range(M))
print(f"C*B = I: {ok}")

# Step 2: Compute g_tilde[j] = sum_i C[j][i] * P_coeffs[i]
num_monos = len(P_coeffs[0])  # 1711
print(f"Computing {M} rescaled polynomials...")
g_tilde = []
for j in range(M):
    coeffs = [0] * num_monos
    for i in range(M):
        c = C[j][i]
        if c != 0:
            for k in range(num_monos):
                coeffs[k] = (coeffs[k] + c * P_coeffs[i][k]) % P_FIELD
    g_tilde.append(coeffs)
print("Done.")

# Verify: g_tilde[j] should have o_j coeff = 1 and o_k coeff = 0 for k != j
print("Verifying o-linear coefficients of g_tilde:")
for j in range(min(5, M)):
    for k in range(NO):
        expected = 1 if k == j else 0
        actual = g_tilde[j][1 + NV + k]
        if actual != expected:
            print(f"  ERROR: g_tilde[{j}] o_{k} coeff = {actual}, expected {expected}")
print("  First 5 polynomials checked OK" if all(g_tilde[j][1+NV+k] == (1 if k==j else 0) for j in range(5) for k in range(NO)) else "  Some mismatch")

# Step 3: Compute targets
targets = [sum(C[j][i] * Y[i] for i in range(M)) % P_FIELD for j in range(M)]

# Step 4: Solve iteratively
v = [ord(c) for c in 'TSGCTF{']
known = list(v)

print("Solving iteratively...")
for j in range(NO):
    partial_x = known + [0] * (N - len(known))
    const_part = evaluate_polynomial(g_tilde[j], partial_x)
    o_j = (targets[j] - const_part) % P_FIELD
    known.append(o_j)

flag = ''.join(chr(c) for c in known)
print(f"\nFlag: {flag}")

# Verify
from problem_eval import evaluate_pubkey  # we'll inline it
def evaluate_pubkey_local(pk_coeffs, vars_values):
    return [evaluate_polynomial(p_i, vars_values) for p_i in pk_coeffs]

Y_check = evaluate_pubkey_local(P_coeffs, known)
print(f"Verification: P(flag) == Y: {Y_check == Y}")
