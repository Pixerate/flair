// flair-metal-hash: 271a138a
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
    float3 uDrink;
    packed_float3 uBubble;
    int uStreams;
    float uRate;
    float uAccel;
    float uSize;
    float uWiggle;
    int uLoose;
};

struct flair_fizz_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 bubble(thread float3& col, thread const float2& d, thread const float& R, thread const float& px, constant FlairUniforms& _132)
{
    float dl = length(d);
    float cover = 1.0 - smoothstep(R - px, R + px, dl);
    if (cover <= 0.0)
    {
        return col;
    }
    float rim = smoothstep(0.3499999940395355224609375 * R, R, dl);
    col = mix(col, float3(_132.uBubble), float3(cover * (0.20000000298023223876953125 + (0.699999988079071044921875 * rim))));
    float2 s = d + (float2(0.300000011920928955078125, -0.300000011920928955078125) * R);
    col = mix(col, float3(1.0), float3(cover * (1.0 - smoothstep(0.0, (0.300000011920928955078125 * R) + px, length(s)))));
    return col;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _132)
{
    float px = 1.0 / _132.iResolution[1u];
    float2 p = fragCoord * px;
    float2 uv = fragCoord / float2(_132.iResolution[0], _132.iResolution[1]);
    float aspect = _132.iResolution[0u] / _132.iResolution[1u];
    float3 col = _132.uDrink * (0.60000002384185791015625 + (0.5 * uv.y));
    col += ((_132.uDrink * 0.25) * exp(((-(uv.x - 0.300000011920928955078125)) * (uv.x - 0.300000011920928955078125)) / 0.01200000010430812835693359375));
    col *= (1.0 - (0.25 * powr(abs(uv.x - 0.5) * 2.0, 3.0)));
    float acc = 0.119999997317790985107421875 * _132.uAccel;
    for (int s = 0; s < 24; s++)
    {
        if (s >= _132.uStreams)
        {
            break;
        }
        float2 param = float2((float(s) * 4.69999980926513671875) + 1.0, 8.30000019073486328125);
        float2 h = hash22(param);
        float2 param_1 = (h * 29.0) + float2(3.0);
        float hs = hash12(param_1);
        float2 site = float2((0.039999999105930328369140625 + (0.920000016689300537109375 * h.x)) * aspect, 0.0199999995529651641845703125 + ((0.4000000059604644775390625 * h.y) * h.y));
        float dy = p.y - site.y;
        bool _304 = dy < (-0.0199999995529651641845703125);
        bool _325;
        if (!_304)
        {
            _325 = abs(p.x - site.x) > ((0.02999999932944774627685546875 * _132.uSize) + (0.0199999995529651641845703125 * _132.uWiggle));
        }
        else
        {
            _325 = _304;
        }
        if (_325)
        {
            continue;
        }
        float rate = _132.uRate * (0.5 + hs);
        float ageHere = ((-0.02999999932944774627685546875) + sqrt(0.000899999984540045261383056640625 + ((2.0 * acc) * fast::max(dy, 0.0)))) / acc;
        float nf = floor(((_132.iTime - ageHere) * rate) - (hs * 7.0));
        for (int k = -1; k <= 1; k++)
        {
            float n = nf + float(k);
            float2 param_2 = float2(n, float(s) + 0.5);
            if (hash12(param_2) < 0.1500000059604644775390625)
            {
                continue;
            }
            float age = _132.iTime - ((n + (hs * 7.0)) / rate);
            if (age < 0.0)
            {
                continue;
            }
            float y = (site.y + (0.02999999932944774627685546875 * age)) + (((0.5 * acc) * age) * age);
            float R = _132.uSize * (0.00150000001303851604461669921875 + (0.0035000001080334186553955078125 * sqrt(fast::max(y - site.y, 0.0) * 3.0)));
            float x = site.x + (((_132.uWiggle * 0.0040000001899898052215576171875) * sin((age * 14.0) + (n * 1.2999999523162841796875))) * fast::min(age, 1.0));
            float3 param_3 = col;
            float2 param_4 = p - float2(x, y);
            float param_5 = R;
            float param_6 = px;
            float3 _463 = bubble(param_3, param_4, param_5, param_6, _132);
            col = _463;
        }
    }
    for (int i = 0; i < 30; i++)
    {
        if (i >= _132.uLoose)
        {
            break;
        }
        float2 param_7 = float2((float(i) * 1.89999997615814208984375) + 0.300000011920928955078125, 2.2000000476837158203125);
        float2 h_1 = hash22(param_7);
        float2 param_8 = h_1 * 13.0;
        float hs_1 = hash12(param_8);
        float R_1 = _132.uSize * mix(0.00200000009499490261077880859375, 0.006000000052154064178466796875, hs_1);
        float y_1 = mod((h_1.y * 1.2000000476837158203125) + ((_132.iTime * (0.0500000007450580596923828125 + (0.100000001490116119384765625 * hs_1))) * _132.uAccel), 1.2000000476837158203125) - 0.100000001490116119384765625;
        float x_1 = (h_1.x * aspect) + ((0.00999999977648258209228515625 * _132.uWiggle) * sin((_132.iTime * (1.0 + hs_1)) + (h_1.y * 20.0)));
        float3 param_9 = col;
        float2 param_10 = p - float2(x_1, y_1);
        float param_11 = R_1;
        float param_12 = px;
        float3 _562 = bubble(param_9, param_10, param_11, param_12, _132);
        col = _562;
    }
    fragColor = float4(col, 1.0);
}

fragment flair_fizz_frag_out flair_fizz_frag(constant FlairUniforms& _132 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fizz_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _582;
    if (_132.flair_flipY > 0.5)
    {
        _582 = _132.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _582 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _582);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _132);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

