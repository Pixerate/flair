// flair-metal-hash: 84de085b
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    int uCount;
    float uRadius;
    float uSize;
    float uDissolve;
    float uTwist;
    uint uUpright;
    float3 uInner;
    float3 uMiddle;
    packed_float3 uOuter;
    uint uDiagonal;
    float uGlow;
    int uSpin;
    int uWaves;
    float uShimmer;
};

struct flair_pixel_bloom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float shimmerAt(thread const float& rn, constant FlairUniforms& _323)
{
    float wave = 0.5 + (0.5 * sin(6.28318023681640625 * (((float(_323.uWaves) * _323.iTime) / 24.0) - rn)));
    return 1.0 - ((_323.uShimmer * 0.300000011920928955078125) * wave);
}

static inline __attribute__((always_inline))
float squareSide(thread const float& n, thread const float& rn, constant FlairUniforms& _323)
{
    float param = rn;
    return (_323.uSize * fast::max(1.0 - ((_323.uDissolve * 0.87999999523162841796875) * rn), 0.0)) * shimmerAt(param, _323);
}

static inline __attribute__((always_inline))
float squareTurn(thread const float& n, thread const float& a, constant FlairUniforms& _323)
{
    return (_323.uUpright != 0u) ? 0.0 : a;
}

static inline __attribute__((always_inline))
float4 phyllo(thread const float2& p, thread const float& count, thread const float& twist, thread const float& maxSide, thread const float& aa, constant FlairUniforms& _323)
{
    float r = length(p);
    float reach = ((maxSide * 0.707199990749359130859375) + aa) + 0.0500000007450580596923828125;
    float lo = fast::max(1.0, floor(fast::max(r - reach, 0.0) * fast::max(r - reach, 0.0)));
    float hi = fast::min(count, ceil((r + reach) * (r + reach)));
    float root = sqrt(fast::max(count, 1.0));
    float theta = precise::atan2(p.y, p.x);
    float4 best = float4(0.0, 0.0, 0.0, 1000.0);
    for (int i = 0; i < 200; i++)
    {
        float n = lo + float(i);
        if (n > hi)
        {
            break;
        }
        float rn = sqrt(n);
        float a = (n * 2.3999631404876708984375) + (twist * rn);
        float dt = abs(mod((a - theta) + 3.1415927410125732421875, 6.283185482025146484375) - 3.1415927410125732421875);
        if (((0.636619985103607177734375 * fast::min(r, rn)) * dt) > reach)
        {
            continue;
        }
        float param = n;
        float param_1 = rn / root;
        float side = squareSide(param, param_1, _323);
        if (side <= 0.0)
        {
            continue;
        }
        float2 d = p - (float2(cos(a), sin(a)) * rn);
        float param_2 = n;
        float param_3 = a;
        float t = squareTurn(param_2, param_3, _323);
        float c = cos(t);
        float s = sin(t);
        d = float2((c * d.x) + (s * d.y), ((-s) * d.x) + (c * d.y));
        float h = side * 0.5;
        float _round = h * 0.2199999988079071044921875;
        float2 q = abs(d) - float2(h - _round);
        float sd = (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - _round;
        float cover = fast::clamp(0.5 - (sd / aa), 0.0, 1.0);
        bool _256 = cover > best.x;
        bool _272;
        if (!_256)
        {
            bool _263 = cover == best.x;
            bool _271;
            if (_263)
            {
                _271 = sd < best.w;
            }
            else
            {
                _271 = _263;
            }
            _272 = _271;
        }
        else
        {
            _272 = _256;
        }
        if (_272)
        {
            best = float4(cover, n, rn / root, sd);
        }
    }
    return best;
}

static inline __attribute__((always_inline))
float3 ramp3(thread const float3& a, thread const float3& b, thread const float3& c, thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    float3 _293;
    if (t < 0.550000011920928955078125)
    {
        _293 = mix(a, b, float3(t / 0.550000011920928955078125));
    }
    else
    {
        _293 = mix(b, c, float3((t - 0.550000011920928955078125) / 0.449999988079071044921875));
    }
    return _293;
}

static inline __attribute__((always_inline))
float4 paintBloom(thread const float4& hit, thread const float2& p, thread const float& bloomR, constant FlairUniforms& _323)
{
    float _329;
    if (_323.uDiagonal != 0u)
    {
        _329 = fast::clamp(0.5 + dot(p / float2(bloomR), float2(0.5, -0.5)), 0.0, 1.0);
    }
    else
    {
        _329 = hit.z;
    }
    float t = _329;
    float3 param = _323.uInner;
    float3 param_1 = _323.uMiddle;
    float3 param_2 = float3(_323.uOuter);
    float param_3 = t;
    float3 _362 = ramp3(param, param_1, param_2, param_3);
    float3 col = _362;
    float glowA = ((_323.uGlow * 0.550000011920928955078125) * exp((-fast::max(hit.w, 0.0)) / 0.3499999940395355224609375)) * step(0.5, hit.y);
    float alpha = fast::max(hit.x, glowA);
    return float4(col, alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _323)
{
    float2 p = (fragCoord - (float2(_323.iResolution[0], _323.iResolution[1]) * 0.5)) / float2(_323.iResolution[1u]);
    float spin = ((6.28318023681640625 * float(_323.uSpin)) * _323.iTime) / 24.0;
    float cs = cos(spin);
    float sn = sin(spin);
    p = float2((cs * p.x) + (sn * p.y), ((-sn) * p.x) + (cs * p.y));
    float count = float(_323.uCount);
    float spacing = _323.uRadius / sqrt(count);
    float2 q = p / float2(spacing);
    float2 param = q;
    float param_1 = count;
    float param_2 = _323.uTwist * 0.60000002384185791015625;
    float param_3 = _323.uSize;
    float param_4 = 1.2000000476837158203125 / (_323.iResolution[1u] * spacing);
    float4 hit = phyllo(param, param_1, param_2, param_3, param_4, _323);
    float4 param_5 = hit;
    float2 param_6 = q;
    float param_7 = sqrt(count);
    float4 c = paintBloom(param_5, param_6, param_7, _323);
    float param_8 = hit.z;
    c.w *= shimmerAt(param_8, _323);
    fragColor = c;
}

fragment flair_pixel_bloom_frag_out flair_pixel_bloom_frag(constant FlairUniforms& _323 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_bloom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _565;
    if (_323.flair_flipY > 0.5)
    {
        _565 = _323.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _565 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _565);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _323);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

