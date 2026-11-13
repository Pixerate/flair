// flair-metal-hash: c13d4053
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
    float3 uHub;
    float3 uSpoke;
    float3 uLink;
    float3 uBranch;
    float3 uLeafA;
    float3 uLeafB;
    float3 uLeafC;
    packed_float3 uSpark;
    int uBranches;
    int uLeaves;
    float uSpread;
    float uSpeed;
    float uFlares;
    float uDrift;
    float uGlow;
    float uSeed;
    char _m29_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_live_network_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 branchAt(thread const float& fi, thread const float& n, thread const float& seed, thread const float2& stretch, constant FlairUniforms& _241)
{
    float2 param = float2(fi, seed + 3.099999904632568359375);
    float h1 = hash12(param);
    float2 param_1 = float2(fi, seed + 7.69999980926513671875);
    float h2 = hash12(param_1);
    float2 param_2 = float2(fi, seed + 12.8999996185302734375);
    float h3 = hash12(param_2);
    float a = ((((fi + 0.20000000298023223876953125) + (0.60000002384185791015625 * h1)) / n) * 6.28318023681640625) + ((_241.iTime * _241.uDrift) * 0.02999999932944774627685546875);
    float2 wob = float2(sin((_241.iTime * (0.4000000059604644775390625 + h2)) + (6.28318023681640625 * h3)), cos((_241.iTime * (0.300000011920928955078125 + h3)) + (6.28318023681640625 * h1))) * 0.0040000001899898052215576171875;
    return float3((((float2(cos(a), sin(a)) * stretch) * _241.uSpread) * (0.62000000476837158203125 + (0.37999999523162841796875 * h2))) + wob, a);
}

static inline __attribute__((always_inline))
float seg(thread const float2& p, thread const float2& a, thread const float2& b, thread float& u)
{
    float2 e = b - a;
    u = fast::clamp(dot(p - a, e) / fast::max(dot(e, e), 9.9999999747524270787835121154785e-07), 0.0, 1.0);
    return length((p - a) - (e * u));
}

static inline __attribute__((always_inline))
float spark(thread const float& u, thread const float& d, thread const float& len, thread const float& ph, thread const float& px, constant FlairUniforms& _241)
{
    float s = fract((((_241.iTime * _241.uSpeed) * 0.119999997317790985107421875) / fast::max(len, 0.0500000007450580596923828125)) + ph);
    float behind = s - u;
    float _353;
    if (behind >= 0.0)
    {
        _353 = exp(((-behind) * len) / 0.039999999105930328369140625);
    }
    else
    {
        _353 = 0.0;
    }
    float trail = _353;
    float fade = sin(3.141590118408203125 * s);
    return fade * (((trail * exp((-d) / ((0.89999997615814208984375 * px) + 0.00120000005699694156646728515625))) * 0.89999997615814208984375) + (exp((-length(float2((u - s) * len, d))) / 0.004999999888241291046142578125) * 1.60000002384185791015625));
}

static inline __attribute__((always_inline))
float4 ball(thread const float2& q, thread const float& R, thread const float3& c, thread const float& px)
{
    float r = length(q);
    float cover = fast::clamp(0.5 - ((r - R) / px), 0.0, 1.0);
    float z = sqrt(fast::max(0.0, 1.0 - (fast::min(r / R, 1.0) * fast::min(r / R, 1.0))));
    float hl = exp((-length((q / float2(R)) - float2(-0.319999992847442626953125, 0.37999999523162841796875))) * 3.2000000476837158203125);
    return float4((c * (0.449999988079071044921875 + (0.64999997615814208984375 * z))) + ((float3(0.89999997615814208984375) * hl) * 0.550000011920928955078125), cover);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float flare(thread const float& h, thread const float& h2, constant FlairUniforms& _241)
{
    float w = 0.5 + (0.5 * sin((_241.iTime * (0.3499999940395355224609375 + (0.5 * h))) + (6.28318023681640625 * h2)));
    return (powr(w, 90.0) * _241.uFlares) * 2.0;
}

static inline __attribute__((always_inline))
float3 glint(thread const float2& q, thread const float& f, thread const float& px, constant FlairUniforms& _241)
{
    float r = length(q);
    float cross1 = exp((-abs(q.y)) / ((1.2000000476837158203125 * px) + 0.0007999999797903001308441162109375)) * exp((-abs(q.x)) / 0.0500000007450580596923828125);
    float cross2 = exp((-abs(q.x)) / ((1.2000000476837158203125 * px) + 0.0007999999797903001308441162109375)) * exp((-abs(q.y)) / 0.0350000001490116119384765625);
    return (float3(_241.uSpark) * f) * ((exp((-r) / 0.01200000010430812835693359375) * 1.2000000476837158203125) + ((cross1 + cross2) * 0.89999997615814208984375));
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _241)
{
    float px = 1.0 / _241.iResolution[1u];
    float2 p = (fragCoord - (float2(_241.iResolution[0], _241.iResolution[1]) * 0.5)) * px;
    float aspect = _241.iResolution[0u] / _241.iResolution[1u];
    float2 stretch = float2(fast::clamp(aspect * 0.85000002384185791015625, 1.0, 1.7999999523162841796875), 1.0);
    float n = float(_241.uBranches);
    float seed = _241.uSeed * 1.37000000476837158203125;
    float3 light = float3(0.0);
    float4 acc = float4(0.0);
    float R0 = 0.034000001847743988037109375;
    float param_10;
    float3 _615;
    float _638;
    float param_23;
    float param_34;
    float _876;
    float3 _929;
    float3 _938;
    for (int i = 0; i < 16; i++)
    {
        if (i >= _241.uBranches)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi, seed + 3.099999904632568359375);
        float h1 = hash12(param);
        float2 param_1 = float2(fi, seed + 7.69999980926513671875);
        float h2 = hash12(param_1);
        float2 param_2 = float2(fi, seed + 12.8999996185302734375);
        float h3 = hash12(param_2);
        float param_3 = fi;
        float param_4 = n;
        float param_5 = seed;
        float2 param_6 = stretch;
        float3 ba = branchAt(param_3, param_4, param_5, param_6, _241);
        float2 b = ba.xy;
        float a = ba.z;
        float len = length(b);
        float2 param_7 = p;
        float2 param_8 = float2(0.0);
        float2 param_9 = b;
        float _606 = seg(param_7, param_8, param_9, param_10);
        float u = param_10;
        float d = _606;
        bool gold = h3 < 0.680000007152557373046875;
        if (gold)
        {
            _615 = _241.uSpoke;
        }
        else
        {
            _615 = _241.uLink;
        }
        float3 sc = _615;
        float core = exp((-d) / ((0.699999988079071044921875 * px) + 0.00039999998989515006542205810546875));
        if (gold)
        {
            _638 = 0.00200000009499490261077880859375 + ((0.0199999995529651641845703125 * (1.0 - u)) * (1.0 - u));
        }
        else
        {
            _638 = 0.00120000005699694156646728515625;
        }
        float w = _638;
        float halo = (exp((-d) / w) * (gold ? 0.550000011920928955078125 : 0.119999997317790985107421875)) * (1.0 - (0.60000002384185791015625 * u));
        light += (sc * ((core * (gold ? 0.75 : 0.550000011920928955078125)) + (halo * _241.uGlow)));
        float param_11 = u;
        float param_12 = d;
        float param_13 = len;
        float param_14 = h1 + (0.37000000476837158203125 * h2);
        float param_15 = px;
        light += (float3(_241.uSpark) * spark(param_11, param_12, param_13, param_14, param_15, _241));
        if (h2 > 0.449999988079071044921875)
        {
            float param_16 = mod(fi + 1.0, n);
            float param_17 = n;
            float param_18 = seed;
            float2 param_19 = stretch;
            float2 b2 = branchAt(param_16, param_17, param_18, param_19, _241).xy;
            float2 param_20 = p;
            float2 param_21 = b;
            float2 param_22 = b2;
            float _727 = seg(param_20, param_21, param_22, param_23);
            float cu = param_23;
            float cd = _727;
            light += ((_241.uLink * exp((-cd) / ((0.60000002384185791015625 * px) + 0.0003000000142492353916168212890625))) * 0.300000011920928955078125);
            float param_24 = cu;
            float param_25 = cd;
            float param_26 = length(b2 - b);
            float param_27 = h3 + 0.5;
            float param_28 = px;
            light += ((float3(_241.uSpark) * 0.5) * spark(param_24, param_25, param_26, param_27, param_28, _241));
        }
        float near = length(p - b);
        if (near > ((_241.uSpread * 0.300000011920928955078125) + 0.07999999821186065673828125))
        {
            continue;
        }
        for (int j = 0; j < 4; j++)
        {
            if (j >= _241.uLeaves)
            {
                break;
            }
            float fj = float(j);
            float2 param_29 = float2((fi * 7.0) + fj, seed + 21.299999237060546875);
            float k1 = hash12(param_29);
            float2 param_30 = float2((fi * 7.0) + fj, seed + 33.09999847412109375);
            float k2 = hash12(param_30);
            float a2 = (a + ((fj - (0.5 * float(_241.uLeaves - 1))) * 1.10000002384185791015625)) + ((k1 - 0.5) * 0.699999988079071044921875);
            float2 l = b + ((float2(cos(a2), sin(a2)) * _241.uSpread) * (0.119999997317790985107421875 + (0.1599999964237213134765625 * k2)));
            float2 param_31 = p;
            float2 param_32 = b;
            float2 param_33 = l;
            float _863 = seg(param_31, param_32, param_33, param_34);
            float lu = param_34;
            float ld = _863;
            float llen = length(l - b);
            if (mod(fj + fi, 2.0) < 1.0)
            {
                _876 = 1.0;
            }
            else
            {
                _876 = step(0.449999988079071044921875, fract((lu * llen) / 0.007000000216066837310791015625));
            }
            float dots = _876;
            light += (((mix(_241.uLink, float3(0.89999997615814208984375), float3(0.4000000059604644775390625)) * exp((-ld) / ((0.60000002384185791015625 * px) + 0.0003000000142492353916168212890625))) * 0.37999999523162841796875) * dots);
            if (k1 > 0.449999988079071044921875)
            {
                float param_35 = lu;
                float param_36 = ld;
                float param_37 = llen;
                float param_38 = k2;
                float param_39 = px;
                light += ((float3(_241.uSpark) * 0.60000002384185791015625) * spark(param_35, param_36, param_37, param_38, param_39, _241));
            }
            if (k2 < 0.4000000059604644775390625)
            {
                _929 = _241.uLeafA;
            }
            else
            {
                if (k2 < 0.75)
                {
                    _938 = _241.uLeafB;
                }
                else
                {
                    _938 = _241.uLeafC;
                }
                _929 = _938;
            }
            float3 lc = _929;
            float lr = (k2 < 0.75) ? 0.0062000001780688762664794921875 : 0.010499999858438968658447265625;
            float2 q = p - l;
            float2 param_40 = q;
            float param_41 = lr;
            float3 param_42 = lc;
            float param_43 = px;
            float4 lb = ball(param_40, param_41, param_42, param_43);
            float4 param_44 = acc;
            float3 param_45 = lb.xyz;
            float param_46 = lb.w;
            acc = over(param_44, param_45, param_46);
            if (k2 >= 0.75)
            {
                float4 param_47 = acc;
                float3 param_48 = lc;
                float param_49 = fast::clamp(0.5 - (abs(length(q) - (lr * 1.4500000476837158203125)) / px), 0.0, 1.0) * 0.449999988079071044921875;
                acc = over(param_47, param_48, param_49);
            }
            light += (((lc * exp((-length(q)) / (0.006000000052154064178466796875 + (0.0040000001899898052215576171875 * _241.uGlow)))) * 0.25) * _241.uGlow);
            float param_50 = k1;
            float param_51 = k2 + fi;
            float2 param_52 = q;
            float param_53 = flare(param_50, param_51, _241);
            float param_54 = px;
            light += glint(param_52, param_53, param_54, _241);
        }
        float2 q_1 = p - b;
        float br = 0.014499999582767486572265625;
        float2 param_55 = q_1;
        float param_56 = br;
        float3 param_57 = _241.uBranch;
        float param_58 = px;
        float4 bb = ball(param_55, param_56, param_57, param_58);
        float rq = length(q_1);
        float4 param_59 = acc;
        float3 param_60 = _241.uBranch;
        float param_61 = fast::clamp(0.5 - (abs(rq - (br * 1.5)) / px), 0.0, 1.0) * 0.5;
        acc = over(param_59, param_60, param_61);
        float4 param_62 = acc;
        float3 param_63 = bb.xyz;
        float param_64 = bb.w;
        acc = over(param_62, param_63, param_64);
        light += (((_241.uBranch * exp((-rq) / (0.01200000010430812835693359375 + (0.008000000379979610443115234375 * _241.uGlow)))) * 0.3499999940395355224609375) * _241.uGlow);
        float param_65 = h2;
        float param_66 = h1 + 0.5;
        float2 param_67 = q_1;
        float param_68 = flare(param_65, param_66, _241);
        float param_69 = px;
        light += glint(param_67, param_68, param_69, _241);
    }
    float r = length(p);
    float ang = precise::atan2(p.y, p.x);
    float x = fast::clamp(r / R0, 0.0, 1.0);
    float body = fast::clamp(0.5 - ((r - R0) / px), 0.0, 1.0);
    float rings = 0.5 + (0.5 * cos(x * 90.0));
    float3 hub = mix(float3(1.0, 0.9700000286102294921875, 0.87999999523162841796875), _241.uHub, float3(smoothstep(0.0, 0.60000002384185791015625, x)));
    hub *= (1.0 - ((0.300000011920928955078125 * smoothstep(0.60000002384185791015625, 1.0, x)) * rings));
    float4 param_70 = acc;
    float3 param_71 = hub;
    float param_72 = body;
    acc = over(param_70, param_71, param_72);
    float cells = 120.0;
    float ac = ((ang / 6.28318023681640625) + 0.5) * cells;
    float2 param_73 = float2(floor(ac), 4.19999980926513671875);
    float s1 = hash12(param_73);
    float slen = R0 * (0.100000001490116119384765625 + (0.300000011920928955078125 * s1));
    float tang = (((fract(ac) - 0.5) / cells) * 6.28318023681640625) * r;
    float sd = fast::max(abs(tang) - (0.5 * px), abs((r - R0) - (slen * 0.5)) - (slen * 0.5));
    float4 param_74 = acc;
    float3 param_75 = _241.uHub;
    float param_76 = fast::clamp(0.5 - (sd / px), 0.0, 1.0) * 0.800000011920928955078125;
    acc = over(param_74, param_75, param_76);
    light += (((_241.uHub * exp((-fast::max(r - R0, 0.0)) / (0.0199999995529651641845703125 + (0.014999999664723873138427734375 * _241.uGlow)))) * (0.60000002384185791015625 + (0.100000001490116119384765625 * sin(_241.iTime * 1.2999999523162841796875)))) * _241.uGlow);
    light = float3(1.0) - exp(-light);
    float la = fast::max(light.x, fast::max(light.y, light.z));
    acc = float4(acc.xyz + (light * (1.0 - acc.w)), acc.w + (la * (1.0 - acc.w)));
    float3 ground = float3(_241.uBackground) * (1.0 + (0.3499999940395355224609375 * exp((-dot(p, p)) * 4.0)));
    float4 base = float4(ground * _241.uBackgroundAlpha, _241.uBackgroundAlpha);
    acc = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    float4 param_77 = acc;
    fragColor = unpremultiply(param_77);
}

fragment flair_live_network_frag_out flair_live_network_frag(constant FlairUniforms& _241 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_live_network_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1359;
    if (_241.flair_flipY > 0.5)
    {
        _1359 = _241.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1359 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1359);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _241);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

