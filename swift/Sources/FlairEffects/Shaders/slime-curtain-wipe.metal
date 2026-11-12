// flair-metal-hash: 008d649a
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
    uint uSwap;
    float3 uColorA;
    packed_float3 uColorB;
    float uMarble;
    int uDripCount;
    float uThickness;
    float uGloss;
    uint uAnimate;
    float uProgress;
    char _m22_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_slime_curtain_wipe_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _412)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_412.uBackdrop) * _412.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_412.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _412)
{
    float4 _545;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _545 = overBackdrop(param, _412);
    }
    else
    {
        float2 param_1 = fract(uv);
        _545 = float4(testCard(param_1), 1.0);
    }
    return _545;
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
float frontAt(thread const float& x, thread float4& gPass)
{
    float s = gPass.w;
    float2 param = float2((x * 2.2999999523162841796875) + s, 0.5);
    float2 param_1 = float2((x * 6.099999904632568359375) + s, 2.5);
    float lag = (0.14000000059604644775390625 * (vnoise(param) - 0.5)) + (0.0500000007450580596923828125 * (vnoise(param_1) - 0.5));
    float belly = 0.02199999988079071044921875 * sqrt(abs(sin((x * 6.5) + s)) + 0.0199999995529651641845703125);
    float wob = (0.01200000010430812835693359375 * sin(((x * 9.0) + (gPass.z * 5.0)) + s)) * (1.0 - gPass.y);
    return (((mix(1.12999999523162841796875, -0.300000011920928955078125, gPass.x) - (0.75 * gPass.y)) + lag) - belly) + wob;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.999999717180685365747194737196e-10), 0.0, 1.0);
    return float2(length(pa - (ba * h)), h);
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float topAt(thread const float& x, thread float4& gPass)
{
    float e = (gPass.y * gPass.y) * (3.0 - (2.0 * gPass.y));
    float2 param = float2((x * 3.099999904632568359375) + gPass.w, 7.0);
    return (mix(1.10000002384185791015625, -0.1599999964237213134765625, e) + (0.039999999105930328369140625 * (vnoise(param) - 0.5))) - (0.02500000037252902984619140625 * sin((x * 2.0) + gPass.w));
}

static inline __attribute__((always_inline))
float smax(thread const float& a, thread const float& b, thread const float& k)
{
    float param = -a;
    float param_1 = -b;
    float param_2 = k;
    return -smin(param, param_1, param_2);
}

static inline __attribute__((always_inline))
float curtain(thread const float2& P, thread const float& aspect, constant FlairUniforms& _412, thread float4& gPass)
{
    float param = P.x;
    float d = frontAt(param, gPass) - P.y;
    float s = gPass.w;
    for (int k = 0; k < 24; k++)
    {
        if (k >= _412.uDripCount)
        {
            break;
        }
        float2 param_1 = float2(float(k) + 0.5, s + 3.2999999523162841796875);
        float2 param_2 = float2(s + 1.7000000476837158203125, float(k) * 2.900000095367431640625);
        float3 h = float3(hash22(param_1), hash12(param_2));
        float x = (((float(k) + 0.5) + ((h.x - 0.5) * 0.699999988079071044921875)) / float(_412.uDripCount)) * aspect;
        if (abs(P.x - x) > 0.119999997317790985107421875)
        {
            continue;
        }
        float param_3 = x;
        float fx = frontAt(param_3, gPass);
        float len = (((0.07999999821186065673828125 + (0.300000011920928955078125 * h.y)) * smoothstep(0.07999999821186065673828125, 0.699999988079071044921875, gPass.x)) * (1.0 + (0.800000011920928955078125 * gPass.y))) * (1.0 + (0.0500000007450580596923828125 * sin((gPass.z * 4.0) + (h.x * 6.280000209808349609375))));
        float w = (0.00999999977648258209228515625 + (0.014999999664723873138427734375 * h.z)) * _412.uThickness;
        float2 b = float2(x, fx - len);
        float2 param_4 = P;
        float2 param_5 = float2(x, fx + 0.02999999932944774627685546875);
        float2 param_6 = b;
        float2 sg = segment(param_4, param_5, param_6);
        float param_7 = d;
        float param_8 = sg.x - (w * mix(1.14999997615814208984375, 0.699999988079071044921875, sg.y));
        float param_9 = 0.02999999932944774627685546875;
        d = smin(param_7, param_8, param_9);
        float param_10 = d;
        float param_11 = length(((P - b) + float2(0.0, w * 0.5)) * float2(1.0, 0.85000002384185791015625)) - (w * 1.60000002384185791015625);
        float param_12 = 0.01200000010430812835693359375;
        d = smin(param_10, param_11, param_12);
    }
    if (gPass.y > 0.0)
    {
        float param_13 = P.x;
        float param_14 = d;
        float param_15 = P.y - topAt(param_13, gPass);
        float param_16 = 0.0199999995529651641845703125;
        d = smax(param_14, param_15, param_16);
        for (int j = 0; j < 6; j++)
        {
            float2 param_17 = float2(float(j) + 0.5, s + 8.1000003814697265625);
            float2 param_18 = float2(s + 4.30000019073486328125, float(j) * 1.2999999523162841796875);
            float3 h_1 = float3(hash22(param_17), hash12(param_18));
            float x_1 = (((float(j) + 0.20000000298023223876953125) + (0.60000002384185791015625 * h_1.x)) / 6.0) * aspect;
            float wj = ((0.01600000075995922088623046875 + (0.0199999995529651641845703125 * h_1.y)) * _412.uThickness) * (1.0 - smoothstep(0.300000011920928955078125, 0.699999988079071044921875 + (0.25 * h_1.z), gPass.y));
            bool _934 = wj <= 0.0;
            bool _944;
            if (!_934)
            {
                _944 = abs(P.x - x_1) > 0.0599999986588954925537109375;
            }
            else
            {
                _944 = _934;
            }
            if (_944)
            {
                continue;
            }
            float param_19 = x_1;
            float2 param_20 = P;
            float2 param_21 = float2(x_1, topAt(param_19, gPass) - 0.00999999977648258209228515625);
            float2 param_22 = float2(x_1, 1.10000002384185791015625);
            float2 sg_1 = segment(param_20, param_21, param_22);
            float param_23 = d;
            float param_24 = sg_1.x - (wj * mix(1.0, 0.550000011920928955078125, sin(3.141590118408203125 * sg_1.y)));
            float param_25 = 0.0500000007450580596923828125;
            d = smin(param_23, param_24, param_25);
        }
    }
    return d;
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
float gooHeight(thread const float2& P, thread const float& aspect, thread float& d, constant FlairUniforms& _412, thread float4& gPass)
{
    float2 param = P;
    float param_1 = aspect;
    d = curtain(param, param_1, _412, gPass);
    float k = 0.0280000008642673492431640625 * _412.uThickness;
    float2 param_2 = float2(P.x * 9.0, (P.y + (gPass.z * 0.3499999940395355224609375)) * 2.5) + float2(gPass.w);
    int param_3 = 3;
    float _1013 = fbm(param_2, param_3);
    float ripple = _1013;
    return (((-1.60000002384185791015625) * k) * exp(fast::min(d, 0.0) / k)) + (((0.02999999932944774627685546875 * _412.uThickness) * ripple) * smoothstep(-0.00999999977648258209228515625, -0.0900000035762786865234375, d));
}

static inline __attribute__((always_inline))
float3 gooShade(thread const float3& goo, thread const float3& n, thread const float& thick, thread const float& gloss)
{
    float3 light = float3(-0.36000001430511474609375, 0.4799999892711639404296875, 0.800000011920928955078125);
    float3 col = mix(goo * 1.14999997615814208984375, goo * 0.62000000476837158203125, float3(thick * 0.60000002384185791015625)) * (0.7799999713897705078125 + (0.2199999988079071044921875 * dot(n, light)));
    col = mix(col, float3(1.0), float3(powr(1.0 - n.z, 2.0) * 0.3499999940395355224609375));
    col *= (1.0 - ((0.25 * smoothstep(0.0, 0.60000002384185791015625, -n.y)) * (1.0 - thick)));
    float rz = fast::max(reflect(-light, n).z, 0.0);
    return fast::min(col + float3(gloss * ((powr(rz, 40.0) * 0.89999997615814208984375) + (powr(rz, 6.0) * 0.119999997317790985107421875))), float3(1.0));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _412, thread float4& gPass, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_412.iResolution[0], _412.iResolution[1]);
    float px = 1.0 / _412.iResolution[1u];
    float aspect = _412.iResolution[0u] / _412.iResolution[1u];
    float2 P = float2(uv.x * aspect, uv.y);
    float t = mod(_412.iTime, 6.0);
    bool second = (_412.uAnimate != 0u) && (t >= 3.0);
    float _1078;
    if (_412.uAnimate != 0u)
    {
        _1078 = (t - (second ? 3.0 : 0.0)) / 3.0;
    }
    else
    {
        _1078 = _412.uProgress;
    }
    float prog = _1078;
    gPass = float4(smoothstep(0.02999999932944774627685546875, 0.4199999868869781494140625, prog), smoothstep(0.5, 0.980000019073486328125, prog), prog * 3.0, second ? 7.0 : 0.0);
    float2 param = uv;
    float4 a = pictureRGBA(uFrom, uFromSmplr, param, _412);
    float4 _1110;
    if (_412.uSwap != 0u)
    {
        float2 param_1 = uv;
        _1110 = pictureRGBA(uTo, uToSmplr, param_1, _412);
    }
    else
    {
        _1110 = a;
    }
    float4 b = _1110;
    float4 _1124;
    if (gPass.y > 0.0)
    {
        _1124 = select(b, a, bool4(second));
    }
    else
    {
        _1124 = select(a, b, bool4(second));
    }
    float4 below = _1124;
    float2 param_2 = P + float2(-0.006000000052154064178466796875, 0.01600000075995922088623046875);
    float param_3 = aspect;
    float dS = curtain(param_2, param_3, _412, gPass);
    float4 _1155 = below;
    float3 _1157 = _1155.xyz * (1.0 - (0.37999999523162841796875 * smoothstep(0.02199999988079071044921875, -0.01200000010430812835693359375, dS)));
    below.x = _1157.x;
    below.y = _1157.y;
    below.z = _1157.z;
    float2 param_4 = P;
    float param_5 = aspect;
    float param_6;
    float _1171 = gooHeight(param_4, param_5, param_6, _412, gPass);
    float d = param_6;
    float h = _1171;
    float cover = fast::clamp(0.5 - (d / px), 0.0, 1.0);
    float4 col = below;
    if (cover > 0.0)
    {
        float eps = px;
        float2 param_7 = P + float2(eps, 0.0);
        float param_8 = aspect;
        float param_9;
        float _1197 = gooHeight(param_7, param_8, param_9, _412, gPass);
        float dd = param_9;
        float2 param_10 = P + float2(0.0, eps);
        float param_11 = aspect;
        float param_12;
        float _1207 = gooHeight(param_10, param_11, param_12, _412, gPass);
        dd = param_12;
        float2 g = float2(_1197, _1207) - float2(h);
        float3 n = fast::normalize(float3((-g) / float2(eps), 1.0));
        float2 param_13 = float2((P.x * 2.5) + gPass.w, (P.y + (gPass.z * 0.3499999940395355224609375)) * 0.89999997615814208984375);
        int param_14 = 4;
        float _1241 = fbm(param_13, param_14);
        float v = _1241;
        float _1247;
        if (_412.uMarble > 0.0)
        {
            _1247 = smoothstep(0.7400000095367431640625 - (0.4000000059604644775390625 * _412.uMarble), 0.75 - (0.4000000059604644775390625 * _412.uMarble), v);
        }
        else
        {
            _1247 = 0.0;
        }
        float m = _1247;
        float3 goo = mix(_412.uColorA, float3(_412.uColorB), float3(m));
        float3 param_15 = goo;
        float3 param_16 = n;
        float param_17 = smoothstep(0.0, -0.07999999821186065673828125, d);
        float param_18 = _412.uGloss;
        col = mix(below, float4(gooShade(param_15, param_16, param_17, param_18), 1.0), float4(cover));
    }
    fragColor = col;
}

fragment flair_slime_curtain_wipe_frag_out flair_slime_curtain_wipe_frag(constant FlairUniforms& _412 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_slime_curtain_wipe_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float4 gPass;
    float _1308;
    if (_412.flair_flipY > 0.5)
    {
        _1308 = _412.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1308 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1308);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _412, gPass, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

