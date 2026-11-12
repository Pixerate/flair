// flair-metal-hash: 49f925d9
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

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
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
    float3 uGold;
    float3 uCardBack;
    packed_float3 uBackground;
    float uGlow;
    float uDust;
    char _m18_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

struct flair_tarot_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float stroke(thread const float& d, thread const float& w, thread const float& px)
{
    return 1.0 - smoothstep(w - px, w + px, abs(d));
}

static inline __attribute__((always_inline))
float sparkle(thread const float2& p, thread const float2& c, thread const float& r)
{
    float2 q = abs(p - c) / float2(r);
    return 1.0 - smoothstep(0.0, 0.0599999986588954925537109375, (((q.x * q.y) * 8.0) + fast::max(q.x, q.y)) - 1.0);
}

static inline __attribute__((always_inline))
float backArt(thread const float2& l, thread const float& px)
{
    float2 param = l;
    float2 param_1 = float2(0.519999980926513671875, 0.939999997615814208984375);
    float param_2 = 0.039999999105930328369140625;
    float param_3 = roundedBox(param, param_1, param_2);
    float param_4 = 0.008000000379979610443115234375;
    float param_5 = px;
    float g = stroke(param_3, param_4, param_5);
    float2 param_6 = l;
    float2 param_7 = float2(0.4799999892711639404296875, 0.89999997615814208984375);
    float param_8 = 0.02999999932944774627685546875;
    float param_9 = roundedBox(param_6, param_7, param_8);
    float param_10 = 0.0040000001899898052215576171875;
    float param_11 = px;
    g = fast::max(g, stroke(param_9, param_10, param_11));
    float r = length(l);
    float a = precise::atan2(l.y, l.x);
    g = fast::max(g, 1.0 - smoothstep(-px, px, r - (0.17000000178813934326171875 + (0.0500000007450580596923828125 * powr(abs(cos(a * 6.0)), 6.0)))));
    float param_12 = r - 0.300000011920928955078125;
    float param_13 = 0.006000000052154064178466796875;
    float param_14 = px;
    g = fast::max(g, stroke(param_12, param_13, param_14));
    float dots = length(float2(fract((a / 6.28318023681640625) * 16.0) - 0.5, (r - 0.37999999523162841796875) * 8.0));
    g = fast::max(g, 1.0 - smoothstep(0.119999997317790985107421875, 0.119999997317790985107421875 + (px * 8.0), dots));
    float moon = fast::max(length(l - float2(0.0, 0.63999998569488525390625)) - 0.100000001490116119384765625, -(length(l - float2(0.039999999105930328369140625, 0.670000016689300537109375)) - 0.085000000894069671630859375));
    g = fast::max(g, 1.0 - smoothstep(-px, px, moon));
    for (int i = 0; i < 4; i++)
    {
        float2 c = float2((spvSMod(i, 2) == 0) ? (-0.3400000035762786865234375) : 0.3400000035762786865234375, (i < 2) ? (-0.699999988079071044921875) : 0.7200000286102294921875);
        float2 param_15 = l;
        float2 param_16 = c;
        float param_17 = 0.070000000298023223876953125;
        g = fast::max(g, sparkle(param_15, param_16, param_17));
    }
    float2 param_18 = l;
    float2 param_19 = float2(0.0, -0.62000000476837158203125);
    float param_20 = 0.10999999940395355224609375;
    g = fast::max(g, sparkle(param_18, param_19, param_20));
    return g;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _156)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_156.uBackdrop) * _156.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_156.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _156)
{
    float4 _298;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _298 = overBackdrop(param, _156);
    }
    else
    {
        float2 param_1 = fract(uv);
        _298 = float4(testCard(param_1), 1.0);
    }
    return _298;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _156)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _156).xyz;
}

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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _156, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 res = float2(_156.iResolution[0], _156.iResolution[1]);
    float t = mod(_156.iTime, 8.0);
    float unit = fast::min(res.y * 0.4000000059604644775390625, (res.x * 0.4000000059604644775390625) / 0.579999983310699462890625);
    float bob = 0.0350000001490116119384765625 * sin(_156.iTime * 1.7000000476837158203125);
    float2 sp = ((fragCoord - (res * 0.5)) / float2(unit)) - float2(0.0, bob);
    float px = 1.5 / unit;
    float flip = smoothstep(3.0, 3.900000095367431640625, t) - smoothstep(7.0, 7.900000095367431640625, t);
    float turn = (3.1415927410125732421875 * flip) + ((0.14000000059604644775390625 * sin(_156.iTime * 1.10000002384185791015625)) * (1.0 - abs(sin(3.1415927410125732421875 * flip))));
    float c = cos(turn);
    float s = sin(turn);
    float flash = exp(-powr((t - 3.5) * 5.0, 2.0));
    float2 uv = (fragCoord - (res * 0.5)) / float2(res.y);
    float3 col = float3(_156.uBackground) * (1.0 - (0.5 * length(uv)));
    float halo = (exp((-length(sp * float2(1.2999999523162841796875, 0.800000011920928955078125))) * 1.60000002384185791015625) * _156.uGlow) * (((0.60000002384185791015625 + (0.1500000059604644775390625 * sin(_156.iTime * 2.0))) + (0.300000011920928955078125 * flip)) + flash);
    col += ((_156.uGold * halo) * 0.550000011920928955078125);
    float den = (5.0 * c) - (sp.x * s);
    if (abs(den) > 9.9999997473787516355514526367188e-05)
    {
        float tr = (5.0 * c) / den;
        float2 l = float2(((tr * sp.x) * c) + (((5.0 * tr) - 5.0) * s), tr * sp.y);
        bool back = c > 0.0;
        if (!back)
        {
            l.x = -l.x;
        }
        float2 param = l;
        float2 param_1 = float2(0.579999983310699462890625, 1.0);
        float param_2 = 0.0500000007450580596923828125;
        float sd = roundedBox(param, param_1, param_2);
        float mask = (1.0 - smoothstep(-px, px, sd)) * step(0.0, tr);
        if (mask > 0.0)
        {
            float2 cuv = ((l / float2(0.579999983310699462890625, 1.0)) * 0.5) + float2(0.5);
            float sheen = exp((-powr(((cuv.x + (cuv.y * 0.5)) - (fract(_156.iTime * 0.20000000298023223876953125) * 2.599999904632568359375)) + 0.4000000059604644775390625, 2.0)) * 30.0);
            float3 gold = _156.uGold * ((0.75 + (0.25 * cuv.y)) + (0.60000002384185791015625 * sheen));
            float3 face;
            if (back)
            {
                face = _156.uCardBack * (0.800000011920928955078125 + (0.300000011920928955078125 * cuv.y));
                float2 param_3 = l;
                float param_4 = px;
                face = mix(face, gold, float3(backArt(param_3, param_4)));
            }
            else
            {
                float2 win = float2(0.4799999892711639404296875, 0.7799999713897705078125);
                float2 wl = l - float2(0.0, 0.119999997317790985107421875);
                float2 wuv = ((wl / win) * 0.5) + float2(0.5);
                float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
                float imageAspect = ts.x / fast::max(ts.y, 1.0);
                float wa = win.x / win.y;
                float2 _856;
                if (imageAspect > wa)
                {
                    _856 = float2(wa / imageAspect, 1.0);
                }
                else
                {
                    _856 = float2(1.0, imageAspect / wa);
                }
                float2 fit = _856;
                float2 param_5 = float2(0.5) + ((wuv - float2(0.5)) * fit);
                float3 pic = picture(uImage, uImageSmplr, param_5, _156);
                face = mix(float3(0.9700000286102294921875, 0.939999997615814208984375, 0.86000001430511474609375), gold, float3(0.1500000059604644775390625));
                float2 param_6 = wl;
                float2 param_7 = win;
                float param_8 = 0.0199999995529651641845703125;
                float wsd = roundedBox(param_6, param_7, param_8);
                face = mix(face, pic, float3(1.0 - smoothstep(-px, px, wsd)));
                float param_9 = wsd;
                float param_10 = 0.01200000010430812835693359375;
                float param_11 = px;
                face = mix(face, gold, float3(stroke(param_9, param_10, param_11)));
                float2 param_12 = l;
                float2 param_13 = float2(0.540000021457672119140625, 0.959999978542327880859375);
                float param_14 = 0.02999999932944774627685546875;
                float param_15 = roundedBox(param_12, param_13, param_14);
                float param_16 = 0.00999999977648258209228515625;
                float param_17 = px;
                face = mix(face, gold, float3(stroke(param_15, param_16, param_17)));
                float2 param_18 = l - float2(0.0, -0.829999983310699462890625);
                float2 param_19 = float2(0.4199999868869781494140625, 0.070000000298023223876953125);
                float param_20 = 0.02999999932944774627685546875;
                float plate = roundedBox(param_18, param_19, param_20);
                face = mix(face, _156.uCardBack, float3(1.0 - smoothstep(-px, px, plate)));
                float param_21 = plate;
                float param_22 = 0.006000000052154064178466796875;
                float param_23 = px;
                face = mix(face, gold, float3(stroke(param_21, param_22, param_23)));
            }
            face *= (0.550000011920928955078125 + (0.449999988079071044921875 * abs(c)));
            face += ((_156.uGold * flash) * 0.3499999940395355224609375);
            col = mix(col, face, float3(mask));
        }
    }
    float dust = 0.0;
    for (int i = 0; i < 28; i++)
    {
        float fi = float(i);
        float2 param_24 = float2(fi, 3.099999904632568359375);
        float2 h = hash22(param_24);
        float y = (fract(h.y + (_156.iTime * (0.039999999105930328369140625 + (0.0500000007450580596923828125 * h.x)))) * 2.400000095367431640625) - 1.2000000476837158203125;
        float2 m = float2(((h.x - 0.5) * 2.2000000476837158203125) + (0.0500000007450580596923828125 * sin((_156.iTime * 0.699999988079071044921875) + fi)), y);
        float2 param_25 = float2(fi, 9.0);
        float r = 0.006000000052154064178466796875 + (0.00999999977648258209228515625 * hash12(param_25));
        float twinkle = 0.5 + (0.5 * sin((_156.iTime * 3.0) + (fi * 1.7000000476837158203125)));
        dust += ((exp((-dot(sp - m, sp - m)) / (r * r)) * twinkle) * smoothstep(1.2000000476837158203125, 0.60000002384185791015625, abs(y)));
    }
    col += (((_156.uGold * dust) * _156.uDust) * (0.5 + (0.800000011920928955078125 * flip)));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _1136;
    if (a > 0.0)
    {
        _1136 = bg + (d / float3(a));
    }
    else
    {
        _1136 = bg;
    }
    float3 fg = _1136;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1158;
    if (alpha > 0.0)
    {
        _1158 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1158 = bg;
    }
    float3 col = _1158;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _156, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _156, uImage, uImageSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_156.uBackground);
    float param_4 = _156.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_tarot_reveal_frag_out flair_tarot_reveal_frag(constant FlairUniforms& _156 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_tarot_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1215;
    if (_156.flair_flipY > 0.5)
    {
        _1215 = _156.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1215 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1215);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _156, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

