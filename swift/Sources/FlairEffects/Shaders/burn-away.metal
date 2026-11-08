// flair-metal-hash: 2f8ed0fe
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
    float2 uOrigin;
    float uRagged;
    float uChar;
    float uFlames;
    float uSparks;
    uint uAnimate;
    float uProgress;
    float3 uHot;
    float3 uMid;
    float3 uCool;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_burn_away_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float burnCycle(constant FlairUniforms& _254)
{
    float u = fract(_254.iTime / 8.0);
    float b = fast::clamp(u / 0.699999988079071044921875, 0.0, 1.0);
    return ((b * b) * (1.60000002384185791015625 - (0.60000002384185791015625 * b))) * (1.0 - smoothstep(0.800000011920928955078125, 0.9700000286102294921875, u));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _254)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_254.uBackdrop) * _254.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_254.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _254)
{
    float4 _651;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _651 = overBackdrop(param, _254);
    }
    else
    {
        float2 param_1 = fract(uv);
        _651 = float4(testCard(param_1), 1.0);
    }
    return _651;
}

static inline __attribute__((always_inline))
float flameNoise(thread const float2& p, thread const float& t)
{
    float2 param = (p * 0.60000002384185791015625) + float2(0.0, (-t) * 0.5);
    int param_1 = 3;
    float _303 = fbm(param, param_1);
    float2 param_2 = (p * 0.60000002384185791015625) + float2(4.30000019073486328125, 1.7000000476837158203125 - (t * 0.699999988079071044921875));
    int param_3 = 3;
    float _315 = fbm(param_2, param_3);
    float2 w = float2(_303, _315);
    float2 param_4 = (p + ((w - float2(0.5)) * 1.7999999523162841796875)) + float2(0.0, -t);
    int param_5 = 4;
    float _331 = fbm(param_4, param_5);
    return _331;
}

static inline __attribute__((always_inline))
float3 fireLight(thread float& h, constant FlairUniforms& _254)
{
    h = fast::clamp(h, 0.0, 1.0);
    float3 c = _254.uCool * smoothstep(0.0, 0.20000000298023223876953125, h);
    c = mix(c, _254.uMid, float3(smoothstep(0.2199999988079071044921875, 0.550000011920928955078125, h)));
    c = mix(c, _254.uHot, float3(smoothstep(0.60000002384185791015625, 0.949999988079071044921875, h)));
    return c * (0.699999988079071044921875 + ((3.0 * h) * h));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float sparks(thread const float2& p, thread const float& t, thread const float& amount)
{
    float s = 0.0;
    for (int l = 0; l < 3; l++)
    {
        float fl = float(l);
        float scale = 7.0 + (5.0 * fl);
        float2 q = (p * scale) - float2(0.0, t * (2.2000000476837158203125 + (0.60000002384185791015625 * fl)));
        float2 cell = floor(q);
        float2 param = cell + float2(fl * 31.700000762939453125);
        float2 param_1 = cell + float2(7.69999980926513671875, fl);
        float3 h = float3(hash22(param), hash12(param_1));
        if (h.z > (amount * 0.5))
        {
            continue;
        }
        float2 c = (float2(0.25) + (h.xy * 0.5)) + float2(0.119999997317790985107421875 * sin((t * 2.5) + (h.x * 40.0)), 0.0);
        float2 d = ((fract(q) - c) * float2(1.0, 0.550000011920928955078125)) / float2(scale);
        float r = (0.001599999959580600261688232421875 + (0.001599999959580600261688232421875 * h.y)) * (1.0 - (0.25 * fl));
        float twinkle = 0.550000011920928955078125 + (0.449999988079071044921875 * sin((t * 17.0) + (h.y * 60.0)));
        s += (exp((-dot(d, d)) / (r * r)) * twinkle);
    }
    return s;
}

static inline __attribute__((always_inline))
float4 fireOver(thread const float4& base, thread float3& light)
{
    light = float3(1.0) - exp(-fast::max(light, float3(0.0)));
    float a = fast::max(light.x, fast::max(light.y, light.z));
    float3 col = (base.xyz * (1.0 - a)) + light;
    float alpha = base.w + (a * (1.0 - base.w));
    return float4(fast::min(col / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(1.0)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _254, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_254.iResolution[0], _254.iResolution[1]);
    float px = 1.0 / _254.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _254.iResolution[0u] * px;
    float2 o = ((_254.uOrigin * 0.5) + float2(0.5)) * float2(aspect, 1.0);
    float u = fract(_254.iTime / 8.0);
    float _735;
    if (_254.uAnimate != 0u)
    {
        _735 = burnCycle(_254);
    }
    else
    {
        _735 = _254.uProgress;
    }
    float burnt = _735;
    float _748;
    if (_254.uAnimate != 0u)
    {
        _748 = smoothstep(0.800000011920928955078125, 0.9700000286102294921875, u);
    }
    else
    {
        _748 = 0.0;
    }
    float restoring = _748;
    float2 d = p - o;
    float reach = length(float2(fast::max(o.x, aspect - o.x), fast::max(o.y, 1.0 - o.y))) + 0.100000001490116119384765625;
    float2 param = p * 5.0;
    int param_1 = 5;
    float _783 = fbm(param, param_1);
    float2 param_2 = p * 22.0;
    int param_3 = 3;
    float _796 = fbm(param_2, param_3);
    float ragged = (((_783 - 0.5) * 0.3499999940395355224609375) * _254.uRagged) + (((_796 - 0.5) * 0.0599999986588954925537109375) * _254.uRagged);
    float dist = length(d * float2(1.0, 0.800000011920928955078125 + (0.20000000298023223876953125 * step(d.y, 0.0)))) + ragged;
    float front = (burnt * (reach + _254.uChar)) - (_254.uChar * 0.5);
    float into = front - dist;
    float2 param_4 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_4, _254);
    float scorch = smoothstep(-_254.uChar, 0.0, into);
    float charred = smoothstep((-_254.uChar) * 0.3499999940395355224609375, 0.0, into);
    float3 col = mix(pic.xyz, pic.xyz * float3(0.75, 0.519999980926513671875, 0.300000011920928955078125), float3(scorch * 0.800000011920928955078125));
    col = mix(col, float3(0.0500000007450580596923828125, 0.02999999932944774627685546875, 0.0199999995529651641845703125), float3(charred));
    float gone = smoothstep(0.0, 0.0040000001899898052215576171875 + px, into);
    float alpha = pic.w * (1.0 - gone);
    float t = _254.iTime * 1.7999999523162841796875;
    float rim = (exp((-abs(into)) / 0.0040000001899898052215576171875) * step(0.001000000047497451305389404296875, burnt)) * (1.0 - restoring);
    float2 param_5 = p * 8.0;
    float param_6 = t;
    float n = flameNoise(param_5, param_6);
    float param_7 = 0.4000000059604644775390625 + (0.3499999940395355224609375 * n);
    float3 _913 = fireLight(param_7, _254);
    float3 light = (_913 * rim) * 1.2000000476837158203125;
    float lift = (0.119999997317790985107421875 * _254.uFlames) * (0.02999999932944774627685546875 + ((1.60000002384185791015625 * n) * n));
    float2 param_8 = float2((p.y * 9.0) - t, p.x * 3.0);
    float2 q = p - float2((vnoise(param_8) - 0.5) * 0.02999999932944774627685546875, lift);
    float2 param_9 = q * 5.0;
    int param_10 = 5;
    float _966 = fbm(param_9, param_10);
    float2 param_11 = q * 22.0;
    int param_12 = 3;
    float _977 = fbm(param_11, param_12);
    float qd = (length((q - o) * float2(1.0, 0.800000011920928955078125 + (0.20000000298023223876953125 * step(q.y - o.y, 0.0)))) + (((_966 - 0.5) * 0.3499999940395355224609375) * _254.uRagged)) + (((_977 - 0.5) * 0.0599999986588954925537109375) * _254.uRagged);
    float heat = (smoothstep(0.01400000043213367462158203125, 0.0, abs(front - qd)) * powr(fast::max(1.0 - (lift / ((0.1599999964237213134765625 * _254.uFlames) + 0.001000000047497451305389404296875)), 0.0), 1.2999999523162841796875)) * (0.449999988079071044921875 + (0.699999988079071044921875 * n));
    heat *= ((step(0.001000000047497451305389404296875, burnt) * (1.0 - restoring)) * step(0.001000000047497451305389404296875, _254.uFlames));
    float param_13 = heat * 1.2000000476837158203125;
    float3 _1020 = fireLight(param_13, _254);
    light += _1020;
    float2 param_14 = p;
    float param_15 = _254.iTime;
    float param_16 = _254.uSparks;
    light += (((((mix(_254.uHot, _254.uMid, float3(0.4000000059604644775390625)) * sparks(param_14, param_15, param_16)) * exp((-abs(into)) / 0.02999999932944774627685546875)) * step(0.001000000047497451305389404296875, burnt)) * (1.0 - restoring)) * 1.39999997615814208984375);
    col = mix(col, pic.xyz, float3(restoring));
    alpha = mix(alpha, pic.w, restoring);
    float4 base = float4(col * alpha, alpha);
    float4 param_17 = base;
    float3 param_18 = light;
    float4 _1080 = fireOver(param_17, param_18);
    fragColor = _1080;
}

fragment flair_burn_away_frag_out flair_burn_away_frag(constant FlairUniforms& _254 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_burn_away_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1092;
    if (_254.flair_flipY > 0.5)
    {
        _1092 = _254.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1092 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1092);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _254, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

