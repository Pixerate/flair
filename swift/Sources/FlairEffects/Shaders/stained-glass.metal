// flair-metal-hash: 1377c78c
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uCells;
    float uLead;
    float3 uLeadColor;
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    float uLight;
    float uSun;
    float uTexture;
    uint uRose;
    float uSpeed;
};

struct flair_stained_glass_frag_out
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
float4 voronoiBorder(thread const float2& p, thread const float& jitter)
{
    float2 n = floor(p);
    float2 f = fract(p);
    float2 mg = float2(0.0);
    float2 mr = float2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 g = float2(float(i), float(j));
            float2 param = n + g;
            float2 r = ((g + float2(0.5)) + ((hash22(param) - float2(0.5)) * jitter)) - f;
            float d = dot(r, r);
            if (d < md)
            {
                md = d;
                mr = r;
                mg = g;
            }
        }
    }
    md = 8.0;
    for (int j_1 = -2; j_1 <= 2; j_1++)
    {
        for (int i_1 = -2; i_1 <= 2; i_1++)
        {
            float2 g_1 = mg + float2(float(i_1), float(j_1));
            float2 param_1 = n + g_1;
            float2 r_1 = ((g_1 + float2(0.5)) + ((hash22(param_1) - float2(0.5)) * jitter)) - f;
            float2 between = r_1 - mr;
            if (dot(between, between) > 9.9999997473787516355514526367188e-06)
            {
                md = fast::min(md, dot((mr + r_1) * 0.5, fast::normalize(between)));
            }
        }
    }
    float2 param_2 = n + mg;
    float2 param_3 = n + mg;
    return float4(((n + mg) + float2(0.5)) + ((hash22(param_2) - float2(0.5)) * jitter), md, hash12(param_3));
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _376)
{
    float px = 1.0 / _376.iResolution[1u];
    float2 p = (fragCoord - (float2(_376.iResolution[0], _376.iResolution[1]) * 0.5)) * px;
    float r = length(p);
    float2 q = p * _376.uCells;
    if (_376.uRose != 0u)
    {
        float seg = 0.52359831333160400390625;
        float a = abs(mod(precise::atan2(p.y, p.x), seg) - (0.5 * seg));
        q = ((float2(cos(a), sin(a)) * r) * _376.uCells) * 2.7999999523162841796875;
    }
    float2 param = q;
    float param_1 = 0.89999997615814208984375;
    float4 v = voronoiBorder(param, param_1);
    float id = v.w;
    float pick = floor(id * 4.0);
    float3 _451;
    if (pick < 1.0)
    {
        _451 = _376.uColorA;
    }
    else
    {
        float3 _460;
        if (pick < 2.0)
        {
            _460 = _376.uColorB;
        }
        else
        {
            float3 _469;
            if (pick < 3.0)
            {
                _469 = _376.uColorC;
            }
            else
            {
                _469 = float3(_376.uColorD);
            }
            _460 = _469;
        }
        _451 = _460;
    }
    float3 glass = _451;
    glass *= (0.699999988079071044921875 + (0.550000011920928955078125 * fract(id * 7.309999942779541015625)));
    float2 param_2 = (q * 1.7000000476837158203125) + float2(id * 13.0);
    int param_3 = 4;
    float _504 = fbm(param_2, param_3);
    float mottle = _504;
    float2 param_4 = float2(q.x * 0.60000002384185791015625, q.y * 5.0) + float2(id * 5.0);
    int param_5 = 3;
    float _521 = fbm(param_4, param_5);
    float streak = _521;
    glass *= mix(1.0, (0.64999997615814208984375 + (0.5 * mottle)) + (0.25 * streak), _376.uTexture);
    float2 bc = floor(q * 9.0);
    float2 param_6 = bc;
    float2 param_7 = bc;
    float bubble = smoothstep(0.119999997317790985107421875, 0.0500000007450580596923828125, length((fract(q * 9.0) - float2(0.5)) - ((hash22(param_6) - float2(0.5)) * 0.60000002384185791015625))) * step(0.930000007152557373046875, hash12(param_7));
    glass *= (1.0 + ((0.4000000059604644775390625 * bubble) * _376.uTexture));
    float t = _376.iTime * _376.uSpeed;
    float2 sun = float2(0.60000002384185791015625 * sin(t * 0.5), 0.25 + (0.20000000298023223876953125 * cos(t * 0.37000000476837158203125)));
    float glow = mix(0.89999997615814208984375, 0.449999988079071044921875 + (1.2000000476837158203125 * exp((-dot(p - sun, p - sun)) * 2.5)), _376.uSun);
    glow *= (0.920000016689300537109375 + (0.07999999821186065673828125 * sin((t * 2.0) + (id * 20.0))));
    float3 col = (glass * glow) * _376.uLight;
    col += (((glass * glass) * fast::max((glow * _376.uLight) - 1.0, 0.0)) * 0.60000002384185791015625);
    float cell = (_376.uCells * px) * ((_376.uRose != 0u) ? 2.7999999523162841796875 : 1.0);
    float half_ = 0.5 * _376.uLead;
    float lead = 1.0 - smoothstep(half_, half_ + (1.5 * cell), v.z);
    col *= (0.75 + (0.25 * smoothstep(half_, (half_ * 3.0) + 0.0199999995529651641845703125, v.z)));
    float3 came = (_376.uLeadColor * (0.699999988079071044921875 + (0.60000002384185791015625 * smoothstep(half_, 0.0, v.z)))) + float3(0.0500000007450580596923828125 * smoothstep(half_ * 0.60000002384185791015625, 0.0, v.z));
    col = mix(col, came, float3(lead));
    if (_376.uRose != 0u)
    {
        float ring = fast::min(abs(r - 0.4600000083446502685546875), abs(r - 0.119999997317790985107421875));
        col = mix(col, came, float3(1.0 - smoothstep(0.008000000379979610443115234375, 0.008000000379979610443115234375 + (1.5 * px), ring)));
        col = mix(col, _376.uLeadColor * 0.60000002384185791015625, float3(smoothstep(0.4600000083446502685546875, 0.4600000083446502685546875 + (1.5 * px), r)));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_stained_glass_frag_out flair_stained_glass_frag(constant FlairUniforms& _376 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_stained_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _763;
    if (_376.flair_flipY > 0.5)
    {
        _763 = _376.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _763 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _763);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _376);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

