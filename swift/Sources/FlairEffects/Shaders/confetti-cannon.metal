// flair-metal-hash: 637b0d47
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
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    int uCount;
    float uInterval;
    float uPower;
    float uSize;
    float uFall;
    uint uCannons;
    uint uDemo;
};

struct flair_confetti_cannon_frag_out
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
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 blast(thread float4& acc, thread const float2& p, thread const float2& origin, thread const float& angle, thread const float& spread, thread const float& speed, thread const float& age, thread const float& seed, thread const int& count, thread const float& px, constant FlairUniforms& _194)
{
    if ((age < 0.0) || (age > 4.5))
    {
        return acc;
    }
    float e = (1.0 - exp((-2.2000000476837158203125) * age)) / 2.2000000476837158203125;
    float fade = 1.0 - smoothstep(3.5, 4.5, age);
    float reach = 0.02999999932944774627685546875 * _194.uSize;
    float drop = (0.1599999964237213134765625 * _194.uFall) * (age - e);
    float2 rel = (p - origin) + float2(0.0, drop);
    float slack = (((reach * 1.41999995708465576171875) + 0.0350000001490116119384765625) + (0.300000011920928955078125 * drop)) + px;
    float r = length(rel);
    float far = speed * e;
    bool _317 = r > (far + slack);
    bool _327;
    if (!_317)
    {
        _327 = r < ((0.5 * far) - slack);
    }
    else
    {
        _327 = _317;
    }
    if (_327)
    {
        return acc;
    }
    if ((spread < 6.19999980926513671875) && (r > slack))
    {
        float off = abs(mod((precise::atan2(rel.y, rel.x) - angle) + 3.1415927410125732421875, 6.283185482025146484375) - 3.1415927410125732421875);
        if (off > (((spread * 0.5) + asin(slack / r)) + 0.00999999977648258209228515625))
        {
            return acc;
        }
    }
    float sd;
    float3 _648;
    float3 _657;
    float3 _667;
    for (int j = 0; j < 80; j++)
    {
        if (j >= count)
        {
            break;
        }
        float fj = float(j);
        float2 param = float2((fj * 7.13000011444091796875) + 1.0, seed);
        float2 h = hash22(param);
        float launch = speed * (0.5 + (0.5 * h.y));
        if (abs(r - (launch * e)) > slack)
        {
            continue;
        }
        float a = angle + ((h.x - 0.5) * spread);
        float2 v0 = float2(cos(a), sin(a)) * launch;
        float2 dv = rel - (v0 * e);
        bool _442 = abs(dv.x) > (reach + 0.0350000001490116119384765625);
        bool _454;
        if (!_442)
        {
            _454 = abs(dv.y) > (reach + (0.300000011920928955078125 * drop));
        }
        else
        {
            _454 = _442;
        }
        if (_454)
        {
            continue;
        }
        float2 param_1 = (h * 53.09999847412109375) + float2(seed);
        float2 h2 = hash22(param_1);
        float2 param_2 = (h2 * 17.700000762939453125) + float2(fj);
        float h3 = hash12(param_2);
        float fall = (0.1599999964237213134765625 * _194.uFall) * (0.699999988079071044921875 + (0.60000002384185791015625 * h2.x));
        float2 pos = (origin + (v0 * e)) - float2(0.0, fall * (age - e));
        pos.x += ((0.0350000001490116119384765625 * sin((age * (2.0 + (2.0 * h2.y))) + (h.x * 6.280000209808349609375))) * smoothstep(0.300000011920928955078125, 1.2000000476837158203125, age));
        float2 dp = p - pos;
        bool _529 = abs(dp.x) > reach;
        bool _538;
        if (!_529)
        {
            _538 = abs(dp.y) > reach;
        }
        else
        {
            _538 = _529;
        }
        if (_538)
        {
            continue;
        }
        float spin = ((age * (2.0 + (5.0 * h2.y))) * ((h3 < 0.5) ? 1.0 : (-1.0))) + (h.x * 6.280000209808349609375);
        float flip = (age * (4.0 + (7.0 * h2.x))) + (h.y * 6.280000209808349609375);
        float face = cos(flip);
        float squash = fast::max(abs(face), 0.0599999986588954925537109375);
        float param_3 = spin;
        float2 q = rot(param_3) * dp;
        q.y /= squash;
        if (h3 < 0.64999997615814208984375)
        {
            float2 d = abs(q) - (float2(0.010999999940395355224609375, 0.00650000013411045074462890625) * _194.uSize);
            sd = length(fast::max(d, float2(0.0))) + fast::min(fast::max(d.x, d.y), 0.0);
        }
        else
        {
            sd = length(q) - (0.00650000013411045074462890625 * _194.uSize);
        }
        float alpha = 1.0 - smoothstep(-px, px / squash, sd);
        if (alpha <= 0.0)
        {
            continue;
        }
        float pick = fract(h3 * 7.30000019073486328125);
        if (pick < 0.25)
        {
            _648 = _194.uColorA;
        }
        else
        {
            if (pick < 0.5)
            {
                _657 = _194.uColorB;
            }
            else
            {
                if (pick < 0.75)
                {
                    _667 = _194.uColorC;
                }
                else
                {
                    _667 = float3(_194.uColorD);
                }
                _657 = _667;
            }
            _648 = _657;
        }
        float3 col = _648;
        col *= ((0.5 + (0.5 * abs(face))) * ((face < 0.0) ? 0.819999992847442626953125 : 1.0));
        col += float3(0.3499999940395355224609375 * powr(abs(face), 16.0));
        float4 param_4 = acc;
        float3 param_5 = fast::min(col, float3(1.0));
        float param_6 = alpha * fade;
        acc = over(param_4, param_5, param_6);
    }
    return acc;
}

static inline __attribute__((always_inline))
float4 clickAt(thread const int& i, thread const bool& demo, thread const float& period, constant FlairUniforms& _194)
{
    bool _182 = !demo;
    bool _202;
    if (!_182)
    {
        _202 = _194.iClicks[0].w > 0.5;
    }
    else
    {
        _202 = _182;
    }
    if (_202)
    {
        return _194.iClicks[i];
    }
    float k = floor(_194.iTime / period) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.20000000298023223876953125) + (h * 0.60000002384185791015625)) * float2(_194.iResolution[0], _194.iResolution[1]), k * period, 1.0);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _194)
{
    float px = 1.0 / _194.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _194.iResolution[0u] / _194.iResolution[1u];
    float4 acc = float4(0.0);
    if (_194.uCannons != 0u)
    {
        float now = floor(_194.iTime / _194.uInterval);
        for (int m = 3; m >= 0; m--)
        {
            float n = now - float(m);
            float age = _194.iTime - (n * _194.uInterval);
            float4 param = acc;
            float2 param_1 = p;
            float2 param_2 = float2(0.0, -0.0199999995529651641845703125);
            float param_3 = 1.01229095458984375;
            float param_4 = 0.699999988079071044921875;
            float param_5 = 2.7999999523162841796875 * _194.uPower;
            float param_6 = age;
            float param_7 = (n * 3.1700000762939453125) + 1.0;
            int param_8 = _194.uCount;
            float param_9 = px;
            float4 _799 = blast(param, param_1, param_2, param_3, param_4, param_5, param_6, param_7, param_8, param_9, _194);
            acc = _799;
            float4 param_10 = acc;
            float2 param_11 = p;
            float2 param_12 = float2(aspect, -0.0199999995529651641845703125);
            float param_13 = 2.1293017864227294921875;
            float param_14 = 0.699999988079071044921875;
            float param_15 = 2.7999999523162841796875 * _194.uPower;
            float param_16 = age;
            float param_17 = (n * 3.1700000762939453125) + 2.0;
            int param_18 = _194.uCount;
            float param_19 = px;
            float4 _825 = blast(param_10, param_11, param_12, param_13, param_14, param_15, param_16, param_17, param_18, param_19, _194);
            acc = _825;
        }
    }
    for (int i = 3; i >= 0; i--)
    {
        int param_20 = i;
        bool param_21 = _194.uDemo != 0u;
        float param_22 = 4.0;
        float4 c = clickAt(param_20, param_21, param_22, _194);
        if (c.w < 0.5)
        {
            continue;
        }
        float4 param_23 = acc;
        float2 param_24 = p;
        float2 param_25 = c.xy * px;
        float param_26 = 1.57079637050628662109375;
        float param_27 = 6.28318023681640625;
        float param_28 = 1.2000000476837158203125 * _194.uPower;
        float param_29 = _194.iTime - c.z;
        float param_30 = (c.z * 1.90999996662139892578125) + float(i);
        int param_31 = (_194.uCount / 2) + 5;
        float param_32 = px;
        float4 _892 = blast(param_23, param_24, param_25, param_26, param_27, param_28, param_29, param_30, param_31, param_32, _194);
        acc = _892;
    }
    float4 param_33 = acc;
    fragColor = unpremultiply(param_33);
}

fragment flair_confetti_cannon_frag_out flair_confetti_cannon_frag(constant FlairUniforms& _194 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_confetti_cannon_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _909;
    if (_194.flair_flipY > 0.5)
    {
        _909 = _194.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _909 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _909);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _194);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

