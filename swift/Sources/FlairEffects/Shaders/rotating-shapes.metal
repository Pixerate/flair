// flair-metal-hash: ce087290
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uBackdrop;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    float uSpeed;
    float uFloat;
    float uGloss;
    float uSoftness;
};

struct flair_rotating_shapes_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 studio(thread const float3& rd, constant FlairUniforms& _128)
{
    float3 c = _128.uBackdrop * mix(0.819999992847442626953125, 1.0499999523162841796875, smoothstep(-0.300000011920928955078125, 0.60000002384185791015625, rd.y));
    c += ((float3(1.2000000476837158203125) * smoothstep(0.75, 0.949999988079071044921875, rd.y)) * smoothstep(-0.20000000298023223876953125, 0.300000011920928955078125, rd.z + 0.4000000059604644775390625));
    return c;
}

static inline __attribute__((always_inline))
float3 centre(thread const int& i, constant FlairUniforms& _128)
{
    float fi = float(i);
    return float3((-1.5499999523162841796875) + (1.5499999523162841796875 * fi), (-0.0500000007450580596923828125) + ((0.180000007152557373046875 * _128.uFloat) * sin(((_128.iTime * _128.uSpeed) * 0.89999997615814208984375) + (fi * 2.099999904632568359375))), (0.1500000059604644775390625 * fi) - 0.1500000059604644775390625);
}

static inline __attribute__((always_inline))
float2 sphereHit(thread const float3& ro, thread const float3& rd, thread const float& r)
{
    float b = dot(ro, rd);
    float c = dot(ro, ro) - (r * r);
    float h = (b * b) - c;
    if (h < 0.0)
    {
        return float2(1000000000.0, -1000000000.0);
    }
    h = sqrt(h);
    return float2((-b) - h, (-b) + h);
}

static inline __attribute__((always_inline))
float2 bounds(thread const float3& ro, thread const float3& rd, constant FlairUniforms& _128)
{
    float2 span = float2(1000000000.0, -1000000000.0);
    for (int i = 0; i < 3; i++)
    {
        int param = i;
        float3 param_1 = ro - centre(param, _128);
        float3 param_2 = rd;
        float param_3 = 0.7799999713897705078125;
        float2 h = sphereHit(param_1, param_2, param_3);
        if (h.x < h.y)
        {
            span = float2(fast::min(span.x, h.x), fast::max(span.y, h.y));
        }
    }
    return float2(fast::max(span.x, 0.0), span.y);
}

static inline __attribute__((always_inline))
float3x3 spin(thread const float& a, thread const float& b)
{
    float ca = cos(a);
    float sa = sin(a);
    float cb = cos(b);
    float sb = sin(b);
    return float3x3(float3(ca, 0.0, -sa), float3(0.0, 1.0, 0.0), float3(sa, 0.0, ca)) * float3x3(float3(1.0, 0.0, 0.0), float3(0.0, cb, sb), float3(0.0, -sb, cb));
}

static inline __attribute__((always_inline))
float sdTorus(thread const float3& p)
{
    float2 q = float2(length(p.xz) - 0.5, p.y);
    return length(q) - 0.189999997615814208984375;
}

static inline __attribute__((always_inline))
float sdRoundBox(thread const float3& p)
{
    float3 q = abs(p) - float3(0.36000001430511474609375);
    return (length(fast::max(q, float3(0.0))) + fast::min(fast::max(q.x, fast::max(q.y, q.z)), 0.0)) - 0.07999999821186065673828125;
}

static inline __attribute__((always_inline))
float sdIcosahedron(thread float3& p)
{
    p = abs(p);
    float d = dot(p, float3(0.57735025882720947265625));
    d = fast::max(d, dot(p, float3(0.0, 0.3568221032619476318359375, 0.934172332286834716796875)));
    d = fast::max(d, dot(p, float3(0.934172332286834716796875, 0.0, 0.3568221032619476318359375)));
    d = fast::max(d, dot(p, float3(0.3568221032619476318359375, 0.934172332286834716796875, 0.0)));
    return d - 0.5;
}

static inline __attribute__((always_inline))
float2 scene(thread const float3& p, constant FlairUniforms& _128)
{
    float t = _128.iTime * _128.uSpeed;
    float2 best = float2(1000000000.0, -1.0);
    float _310;
    float _319;
    for (int i = 0; i < 3; i++)
    {
        int param = i;
        float param_1 = (t * (0.5 + (0.1500000059604644775390625 * float(i)))) + float(i);
        float param_2 = (t * 0.699999988079071044921875) + (float(i) * 1.2999999523162841796875);
        float3 q = (p - centre(param, _128)) * spin(param_1, param_2);
        if (i == 0)
        {
            float3 param_3 = q;
            _310 = sdTorus(param_3);
        }
        else
        {
            if (i == 1)
            {
                float3 param_4 = q;
                _319 = sdRoundBox(param_4);
            }
            else
            {
                float3 param_5 = q;
                float _328 = sdIcosahedron(param_5);
                _319 = _328;
            }
            _310 = _319;
        }
        float d = _310;
        if (d < best.x)
        {
            best = float2(d, float(i));
        }
    }
    return best;
}

static inline __attribute__((always_inline))
float3 normalAt(thread const float3& p, constant FlairUniforms& _128)
{
    float2 e = float2(0.00150000001303851604461669921875, -0.00150000001303851604461669921875);
    float3 param = p + e.xyy;
    float3 param_1 = p + e.yyx;
    float3 param_2 = p + e.yxy;
    float3 param_3 = p + e.xxx;
    return fast::normalize((((e.xyy * scene(param, _128).x) + (e.yyx * scene(param_1, _128).x)) + (e.yxy * scene(param_2, _128).x)) + (e.xxx * scene(param_3, _128).x));
}

static inline __attribute__((always_inline))
float softShadow(thread const float3& p, thread const float3& l, constant FlairUniforms& _128)
{
    float3 param = p;
    float3 param_1 = l;
    float2 b = bounds(param, param_1, _128);
    if (b.x > b.y)
    {
        return 1.0;
    }
    float k = 10.0 / _128.uSoftness;
    float res = 1.0;
    float t = fast::max(b.x, 0.0199999995529651641845703125);
    for (int i = 0; i < 28; i++)
    {
        if (t > b.y)
        {
            break;
        }
        float3 param_2 = p + (l * t);
        float h = scene(param_2, _128).x;
        res = fast::min(res, (k * h) / t);
        if (res < 0.00200000009499490261077880859375)
        {
            break;
        }
        t += fast::clamp(h, 0.02999999932944774627685546875, 0.300000011920928955078125);
    }
    return smoothstep(0.0, 1.0, res);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _128)
{
    float2 p = (fragCoord - (float2(_128.iResolution[0], _128.iResolution[1]) * 0.5)) / float2(_128.iResolution[1u]);
    float3 ro = float3(0.0, 0.75, 5.599999904632568359375);
    float3 target = float3(0.0, -0.1500000059604644775390625, 0.0);
    float3 fw = fast::normalize(target - ro);
    float3 rt = fast::normalize(cross(fw, float3(0.0, 1.0, 0.0)));
    float3 up = cross(rt, fw);
    float3 rd = fast::normalize(((rt * p.x) + (up * p.y)) + (fw * 1.89999997615814208984375));
    float3 l = float3(0.4964230358600616455078125, 0.7671992778778076171875, 0.4061643183231353759765625);
    float3 param = rd;
    float3 col = studio(param, _128) * (0.89999997615814208984375 + (0.100000001490116119384765625 * smoothstep(-0.300000011920928955078125, 0.20000000298023223876953125, rd.y)));
    float _622;
    if (rd.y < 0.0)
    {
        _622 = ((-1.0) - ro.y) / rd.y;
    }
    else
    {
        _622 = 1000000000.0;
    }
    float tFloor = _622;
    float tHit = 1000000000.0;
    float id = -1.0;
    float3 param_1 = ro;
    float3 param_2 = rd;
    float2 b = bounds(param_1, param_2, _128);
    if (b.x < b.y)
    {
        float t = b.x;
        for (int i = 0; i < 64; i++)
        {
            float3 param_3 = ro + (rd * t);
            float2 h = scene(param_3, _128);
            if (h.x < (0.001000000047497451305389404296875 * t))
            {
                tHit = t;
                id = h.y;
                break;
            }
            t += h.x;
            if (t > b.y)
            {
                break;
            }
        }
    }
    if (tHit < tFloor)
    {
        float3 pos = ro + (rd * tHit);
        float3 param_4 = pos;
        float3 n = normalAt(param_4, _128);
        float3 _711;
        if (id < 0.5)
        {
            _711 = _128.uColorA;
        }
        else
        {
            float3 _721;
            if (id < 1.5)
            {
                _721 = _128.uColorB;
            }
            else
            {
                _721 = float3(_128.uColorC);
            }
            _711 = _721;
        }
        float3 base = _711;
        float3 param_5 = pos + (n * 0.00999999977648258209228515625);
        float3 param_6 = l;
        float diff = fast::max(dot(n, l), 0.0) * softShadow(param_5, param_6, _128);
        float3 param_7 = pos + (n * 0.119999997317790985107421875);
        float ao = fast::clamp(0.5 + ((0.5 * scene(param_7, _128).x) / 0.119999997317790985107421875), 0.0, 1.0);
        ao *= fast::clamp(0.60000002384185791015625 + (0.4000000059604644775390625 * (pos.y + 1.0)), 0.0, 1.0);
        float sky = 0.5 + (0.5 * n.y);
        float3 lit = (base * (((0.25 * sky) * ao) + (0.85000002384185791015625 * diff))) + ((((base * _128.uBackdrop) * 0.119999997317790985107421875) * (1.0 - sky)) * ao);
        float3 h_1 = fast::normalize(l - rd);
        float fres = powr(1.0 - fast::max(dot(n, -rd), 0.0), 5.0);
        float spec = (powr(fast::max(dot(n, h_1), 0.0), mix(8.0, 90.0, _128.uGloss)) * diff) * mix(0.100000001490116119384765625, 0.89999997615814208984375, _128.uGloss);
        float3 param_8 = reflect(rd, n);
        float3 env = studio(param_8, _128);
        col = (lit + float3(spec)) + (((env * mix(0.0199999995529651641845703125, 0.25, _128.uGloss)) * mix(0.300000011920928955078125, 1.0, fres)) * ao);
    }
    else
    {
        if (tFloor < 100000000.0)
        {
            float3 pos_1 = ro + (rd * tFloor);
            float3 param_9 = pos_1;
            float3 param_10 = l;
            float shadow = softShadow(param_9, param_10, _128);
            float3 param_11 = pos_1;
            float near = scene(param_11, _128).x;
            float ao_1 = mix(0.550000011920928955078125, 1.0, smoothstep(0.0, 0.60000002384185791015625, near));
            float3 floorCol = (_128.uBackdrop * (0.62000000476837158203125 + (0.37999999523162841796875 * shadow))) * ao_1;
            col = mix(floorCol, col, float3(smoothstep(9.0, 16.0, tFloor)));
        }
    }
    col *= (1.0 - (0.25 * dot(p, p)));
    fragColor = float4(powr(fast::clamp(col, float3(0.0), float3(1.0)), float3(0.89999997615814208984375)), 1.0);
}

fragment flair_rotating_shapes_frag_out flair_rotating_shapes_frag(constant FlairUniforms& _128 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_rotating_shapes_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _926;
    if (_128.flair_flipY > 0.5)
    {
        _926 = _128.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _926 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _926);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _128);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

