// flair-metal-hash: 28147288
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
    float3 uHub;
    float3 uComet;
    float3 uSpoke;
    float3 uBranch;
    float3 uLeafA;
    packed_float3 uLeafB;
    int uBranches;
    int uLeaves;
    float uSpread;
    float uGlow;
    float uSeed;
    uint uAnimate;
    float uCycle;
    float uProgress;
    char _m27_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_network_bloom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float easeOut(thread float& x)
{
    x = fast::clamp(x, 0.0, 1.0);
    return 1.0 - (((1.0 - x) * (1.0 - x)) * (1.0 - x));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float seg(thread const float2& p, thread const float2& a, thread const float2& b, thread float& u)
{
    float2 e = b - a;
    u = fast::clamp(dot(p - a, e) / fast::max(dot(e, e), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
    return length((p - a) - (e * u));
}

static inline __attribute__((always_inline))
float3 grow(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& e, thread const float& warm, thread const float3& settled, thread const float& width, thread const float& px, constant FlairUniforms& _277)
{
    if (e <= 0.0)
    {
        return float3(0.0);
    }
    float2 tip = a + ((b - a) * e);
    float2 param = p;
    float2 param_1 = a;
    float2 param_2 = tip;
    float param_3;
    float _260 = seg(param, param_1, param_2, param_3);
    float u = param_3;
    float d = _260;
    float len = length(tip - a);
    float3 c = mix(_277.uComet, settled, float3(warm));
    float core = exp((-d) / ((0.699999988079071044921875 * px) + (0.00039999998989515006542205810546875 * width)));
    float halo = (((exp((-d) / (0.00200000009499490261077880859375 + (((0.0199999995529651641845703125 * width) * (1.0 - u)) * (1.0 - u)))) * 0.550000011920928955078125) * width) * (1.0 - (0.60000002384185791015625 * u))) * warm;
    float flying = 1.0 - smoothstep(0.89999997615814208984375, 1.0, e);
    float trail = (exp(((-(1.0 - u)) * len) / 0.0599999986588954925537109375) * exp((-d) / (0.0030000000260770320892333984375 + (0.00200000009499490261077880859375 * _277.uGlow)))) * flying;
    float head = (exp((-length(p - tip)) / (0.006000000052154064178466796875 + (0.0040000001899898052215576171875 * _277.uGlow))) * flying) * 1.7999999523162841796875;
    return (c * ((core * 0.699999988079071044921875) + (halo * _277.uGlow))) + ((_277.uComet * ((trail * 0.89999997615814208984375) + head)) * _277.uGlow);
}

static inline __attribute__((always_inline))
float4 ball(thread const float2& q, thread const float& R, thread const float3& c, thread const float& px)
{
    float r = length(q);
    float cover = fast::clamp(0.5 - ((r - R) / px), 0.0, 1.0);
    float z = sqrt(fast::max(0.0, 1.0 - (fast::min(r / fast::max(R, 9.9999997473787516355514526367188e-05), 1.0) * fast::min(r / fast::max(R, 9.9999997473787516355514526367188e-05), 1.0))));
    float hl = exp((-length((q / float2(fast::max(R, 9.9999997473787516355514526367188e-05))) - float2(-0.319999992847442626953125, 0.37999999523162841796875))) * 3.2000000476837158203125);
    return float4((c * (0.449999988079071044921875 + (0.64999997615814208984375 * z))) + ((float3(0.89999997615814208984375) * hl) * 0.550000011920928955078125), cover);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _277)
{
    float px = 1.0 / _277.iResolution[1u];
    float2 p = (fragCoord - (float2(_277.iResolution[0], _277.iResolution[1]) * 0.5)) * px;
    float aspect = _277.iResolution[0u] / _277.iResolution[1u];
    float2 stretch = float2(fast::clamp(aspect * 0.85000002384185791015625, 1.0, 1.7999999523162841796875), 1.0);
    float _423;
    if (_277.uAnimate != 0u)
    {
        _423 = fract(_277.iTime / _277.uCycle);
    }
    else
    {
        _423 = _277.uProgress;
    }
    float t = _423;
    float shown = smoothstep(0.0, 0.02999999932944774627685546875, t) * (1.0 - smoothstep(0.89999997615814208984375, 1.0, t));
    float n = float(_277.uBranches);
    float seed = _277.uSeed * 1.37000000476837158203125;
    float3 light = float3(0.0);
    float4 acc = float4(0.0);
    float param = t / 0.07999999821186065673828125;
    float _467 = easeOut(param);
    float hubIn = _467;
    float flare = exp((-fast::max(t - 0.07999999821186065673828125, 0.0)) * 30.0) * step(0.07999999821186065673828125, t);
    float R0 = 0.034000001847743988037109375 * hubIn;
    float3 _591;
    float3 _773;
    for (int i = 0; i < 16; i++)
    {
        if (i >= _277.uBranches)
        {
            break;
        }
        float fi = float(i);
        float2 param_1 = float2(fi, seed + 3.099999904632568359375);
        float h1 = hash12(param_1);
        float2 param_2 = float2(fi, seed + 7.69999980926513671875);
        float h2 = hash12(param_2);
        float2 param_3 = float2(fi, seed + 12.8999996185302734375);
        float h3 = hash12(param_3);
        float a = (((fi + 0.20000000298023223876953125) + (0.60000002384185791015625 * h1)) / n) * 6.28318023681640625;
        float2 b = ((float2(cos(a), sin(a)) * stretch) * _277.uSpread) * (0.62000000476837158203125 + (0.37999999523162841796875 * h2));
        float start = 0.07999999821186065673828125 + (0.100000001490116119384765625 * h3);
        float param_4 = (t - start) / (0.119999997317790985107421875 + (0.039999999105930328369140625 * h2));
        float _571 = easeOut(param_4);
        float e = _571;
        float land = (start + 0.119999997317790985107421875) + (0.039999999105930328369140625 * h2);
        float warm = smoothstep(land, land + 0.119999997317790985107421875, t);
        bool gold = h3 < 0.680000007152557373046875;
        if (gold)
        {
            _591 = _277.uSpoke;
        }
        else
        {
            _591 = _277.uComet;
        }
        float2 param_5 = p;
        float2 param_6 = float2(0.0);
        float2 param_7 = b;
        float param_8 = e;
        float param_9 = warm;
        float3 param_10 = _591;
        float param_11 = gold ? 1.0 : 0.1500000059604644775390625;
        float param_12 = px;
        light += grow(param_5, param_6, param_7, param_8, param_9, param_10, param_11, param_12, _277);
        bool _621 = e <= 0.0;
        bool _635;
        if (!_621)
        {
            _635 = length(p - b) > ((_277.uSpread * 0.300000011920928955078125) + 0.100000001490116119384765625);
        }
        else
        {
            _635 = _621;
        }
        if (_635)
        {
            continue;
        }
        for (int j = 0; j < 4; j++)
        {
            if (j >= _277.uLeaves)
            {
                break;
            }
            float fj = float(j);
            float2 param_13 = float2((fi * 7.0) + fj, seed + 21.299999237060546875);
            float k1 = hash12(param_13);
            float2 param_14 = float2((fi * 7.0) + fj, seed + 33.09999847412109375);
            float k2 = hash12(param_14);
            float a2 = (a + ((fj - (0.5 * float(_277.uLeaves - 1))) * 1.10000002384185791015625)) + ((k1 - 0.5) * 0.699999988079071044921875);
            float2 l = b + ((float2(cos(a2), sin(a2)) * _277.uSpread) * (0.119999997317790985107421875 + (0.1599999964237213134765625 * k2)));
            float ls = ((land + 0.00999999977648258209228515625) + (0.02500000037252902984619140625 * fj)) + (0.0199999995529651641845703125 * k1);
            float param_15 = (t - ls) / 0.070000000298023223876953125;
            float _732 = easeOut(param_15);
            float le = _732;
            if (le <= 0.0)
            {
                continue;
            }
            float lw = smoothstep(ls + 0.070000000298023223876953125, ls + 0.17000000178813934326171875, t);
            float2 param_16 = p;
            float2 param_17 = b;
            float2 param_18 = l;
            float param_19 = le;
            float param_20 = lw;
            float3 param_21 = mix(_277.uComet, float3(0.85000002384185791015625), float3(0.5)) * 0.60000002384185791015625;
            float param_22 = 0.0;
            float param_23 = px;
            light += (grow(param_16, param_17, param_18, param_19, param_20, param_21, param_22, param_23, _277) * 0.699999988079071044921875);
            if (k2 < 0.550000011920928955078125)
            {
                _773 = _277.uLeafA;
            }
            else
            {
                _773 = float3(_277.uLeafB);
            }
            float3 lc = _773;
            float pop = smoothstep(0.85000002384185791015625, 1.0, le);
            float lr = (((k2 < 0.300000011920928955078125) ? 0.010499999858438968658447265625 : 0.0062000001780688762664794921875) * pop) * (1.0 + (0.4000000059604644775390625 * exp((-fast::max((t - ls) - 0.070000000298023223876953125, 0.0)) * 40.0)));
            float2 q = p - l;
            float2 param_24 = q;
            float param_25 = lr;
            float3 param_26 = lc;
            float param_27 = px;
            float4 lb = ball(param_24, param_25, param_26, param_27);
            float4 param_28 = acc;
            float3 param_29 = lb.xyz;
            float param_30 = lb.w;
            acc = over(param_28, param_29, param_30);
            light += ((((mix(_277.uComet, lc, float3(lw)) * exp((-length(q)) / (0.006000000052154064178466796875 + (0.0040000001899898052215576171875 * _277.uGlow)))) * 0.3499999940395355224609375) * pop) * _277.uGlow);
        }
        float pop_1 = smoothstep(0.85000002384185791015625, 1.0, e);
        float burst = exp((-fast::max(t - land, 0.0)) * 25.0) * step(land, t);
        float br = (0.014499999582767486572265625 * pop_1) * (1.0 + (0.5 * burst));
        float2 q_1 = p - b;
        float rq = length(q_1);
        float2 param_31 = q_1;
        float param_32 = br;
        float3 param_33 = _277.uBranch;
        float param_34 = px;
        float4 bb = ball(param_31, param_32, param_33, param_34);
        float4 param_35 = acc;
        float3 param_36 = _277.uBranch;
        float param_37 = (fast::clamp(0.5 - (abs(rq - (br * 1.5)) / px), 0.0, 1.0) * 0.5) * warm;
        acc = over(param_35, param_36, param_37);
        float4 param_38 = acc;
        float3 param_39 = bb.xyz;
        float param_40 = bb.w;
        acc = over(param_38, param_39, param_40);
        light += ((((mix(_277.uComet, _277.uBranch, float3(warm)) * exp((-rq) / (0.01200000010430812835693359375 + (0.008000000379979610443115234375 * _277.uGlow)))) * (0.3499999940395355224609375 + (2.0 * burst))) * pop_1) * _277.uGlow);
    }
    float r = length(p);
    float ang = precise::atan2(p.y, p.x);
    if (R0 > 0.0)
    {
        float x = fast::clamp(r / R0, 0.0, 1.0);
        float body = fast::clamp(0.5 - ((r - R0) / px), 0.0, 1.0);
        float3 hub = mix(float3(1.0, 0.9700000286102294921875, 0.87999999523162841796875), _277.uHub, float3(smoothstep(0.0, 0.60000002384185791015625, x)));
        hub *= (1.0 - ((0.300000011920928955078125 * smoothstep(0.60000002384185791015625, 1.0, x)) * (0.5 + (0.5 * cos(x * 90.0)))));
        float4 param_41 = acc;
        float3 param_42 = hub;
        float param_43 = body;
        acc = over(param_41, param_42, param_43);
        float cells = 120.0;
        float ac = ((ang / 6.28318023681640625) + 0.5) * cells;
        float2 param_44 = float2(floor(ac), 4.19999980926513671875);
        float slen = (R0 * (0.100000001490116119384765625 + (0.300000011920928955078125 * hash12(param_44)))) * (1.0 + (1.5 * flare));
        float tang = (((fract(ac) - 0.5) / cells) * 6.28318023681640625) * r;
        float sd = fast::max(abs(tang) - (0.5 * px), abs((r - R0) - (slen * 0.5)) - (slen * 0.5));
        float4 param_45 = acc;
        float3 param_46 = _277.uHub;
        float param_47 = fast::clamp(0.5 - (sd / px), 0.0, 1.0) * 0.800000011920928955078125;
        acc = over(param_45, param_46, param_47);
    }
    light += ((((_277.uHub * exp((-fast::max(r - R0, 0.0)) / ((0.0199999995529651641845703125 + (0.014999999664723873138427734375 * _277.uGlow)) + (0.0500000007450580596923828125 * flare)))) * (0.5 + (1.5 * flare))) * _277.uGlow) * hubIn);
    acc *= shown;
    light = (float3(1.0) - exp(-light)) * shown;
    float la = fast::max(light.x, fast::max(light.y, light.z));
    acc = float4(acc.xyz + (light * (1.0 - acc.w)), acc.w + (la * (1.0 - acc.w)));
    float3 ground = float3(_277.uBackground) * (1.0 + (0.3499999940395355224609375 * exp((-dot(p, p)) * 4.0)));
    float4 base = float4(ground * _277.uBackgroundAlpha, _277.uBackgroundAlpha);
    acc = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    float4 param_48 = acc;
    fragColor = unpremultiply(param_48);
}

fragment flair_network_bloom_frag_out flair_network_bloom_frag(constant FlairUniforms& _277 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_network_bloom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1213;
    if (_277.flair_flipY > 0.5)
    {
        _1213 = _277.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1213 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1213);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _277);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

