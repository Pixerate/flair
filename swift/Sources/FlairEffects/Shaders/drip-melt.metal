// flair-metal-hash: 9e229cba
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
    int uDrips;
    float uSpeed;
    float uViscosity;
    float uGloss;
    packed_float3 uBackground;
    uint uAnimate;
    float uProgress;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

struct flair_drip_melt_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float meltCycle(thread const float& rate, constant FlairUniforms& _282)
{
    float u = fract(_282.iTime / 8.0);
    float m = fast::clamp((fast::min(u, 0.62000000476837158203125) * 2.0) * rate, 0.0, 1.0);
    m = (m * m) * (3.0 - (2.0 * m));
    return m * (1.0 - smoothstep(0.7400000095367431640625, 0.9700000286102294921875, u));
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
float edgeY(thread const float& x, thread const float& m)
{
    float2 param = float2(x * 3.5, 1.7000000476837158203125);
    int param_1 = 3;
    float _527 = fbm(param, param_1);
    return 1.0 - (m * (0.039999999105930328369140625 + (0.300000011920928955078125 * smoothstep(0.25, 0.699999988079071044921875, _527))));
}

static inline __attribute__((always_inline))
float poolY(thread const float& x, thread const float& m, constant FlairUniforms& _282)
{
    float2 param = float2(x * 6.0, 2.0);
    return (m * ((0.100000001490116119384765625 + (0.01200000010430812835693359375 * sin((x * 9.0) + (_282.iTime * 0.785399973392486572265625)))) + (0.02500000037252902984619140625 * vnoise(param)))) - 0.006000000052154064178466796875;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 smin4(thread const float4& a, thread const float4& b, thread float& k)
{
    k = fast::max(k, 9.9999997473787516355514526367188e-05);
    float4 h = fast::clamp(float4(0.5) + (((b - a) * 0.5) / float4(k)), float4(0.0), float4(1.0));
    return mix(b, a, h) - ((h * k) * (float4(1.0) - h));
}

static inline __attribute__((always_inline))
float4 liquid(thread const float4& xs, thread const float4& ys, thread const float4& edge, thread const float4& pool, thread const float& m, thread const float4& matter, thread float& aspect, constant FlairUniforms& _282)
{
    float n = float(_282.uDrips);
    float grow = smoothstep(0.0, 0.20000000298023223876953125, m);
    float4 e = edge + float4(0.00999999977648258209228515625 * (1.0 - grow));
    float lip = 0.02199999988079071044921875 * grow;
    float4 d = fast::max(ys - e, (e - float4(lip)) - ys);
    float4 cs = floor(xs * n);
    float c = cs.y;
    float topMin = (1.0 - (m * 0.3400000035762786865234375)) - (lip * 0.5);
    float topMax = (1.0 - (m * 0.039999999105930328369140625)) - (lip * 0.5);
    float poolMin = (m * 0.087999999523162841796875) - 0.006000000052154064178466796875;
    float4 reach = matter + float4(0.1599999964237213134765625);
    for (int k = -3; k <= 3; k++)
    {
        float ci = c + float(k);
        bool4 near = abs(cs - float4(ci)) <= float4(2.0);
        if (!any(near))
        {
            continue;
        }
        float2 param = float2(ci, 3.099999904632568359375);
        float2 h = hash22(param);
        float xi = ((ci + 0.20000000298023223876953125) + (0.60000002384185791015625 * h.x)) / n;
        float2 param_1 = float2(ci, 7.69999980926513671875);
        float w = fast::min(_282.uViscosity * (0.699999988079071044921875 + (0.60000002384185791015625 * hash12(param_1))), (0.60000002384185791015625 * aspect) / n) * grow;
        float f = powr(m, 1.39999997615814208984375) * fast::min(0.20000000298023223876953125 + (0.949999988079071044921875 * h.y), 1.0);
        float headMin = fast::min(topMin, (topMin * (1.0 - f)) + (f * poolMin));
        float4 gap = abs(xs - float4(xi)) * aspect;
        float4 rise = fast::max(fast::max(float4(headMin) - ys, ys - float4(topMax)), float4(0.0));
        float4 nearest = sqrt((gap * gap) + (rise * rise)) - float4(1.2999999523162841796875 * w);
        bool4 counts = ((float4(near) * step(nearest, d + float4(0.01200000010430812835693359375 * grow))) * step(nearest, reach)) != float4(0.0);
        if (!any(counts))
        {
            continue;
        }
        float param_2 = xi;
        float param_3 = m;
        float top = edgeY(param_2, param_3) - (lip * 0.5);
        float param_4 = xi;
        float param_5 = m;
        float len = f * fast::max(top - poolY(param_4, param_5, _282), 0.0);
        float head = top - len;
        float4 along = fast::clamp(ys, float4(head), float4(top));
        float4 r = mix(float4(0.85000002384185791015625), float4(0.60000002384185791015625), smoothstep(float4(top), float4(top - 0.300000011920928955078125), ys)) * w;
        r = mix(r, float4(w * 1.2999999523162841796875), smoothstep(float4(head + (3.0 * w)), float4(head), ys));
        float4 dx = (xs - float4(xi)) * aspect;
        float4 dy = ys - along;
        float4 param_6 = d;
        float4 param_7 = sqrt((dx * dx) + (dy * dy)) - r;
        float param_8 = 0.01200000010430812835693359375 * grow;
        float4 _887 = smin4(param_6, param_7, param_8);
        float4 dd = _887;
        d = select(d, dd, near);
    }
    float4 param_9 = d;
    float4 param_10 = ys - pool;
    float param_11 = 0.02999999932944774627685546875 * grow;
    float4 _904 = smin4(param_9, param_10, param_11);
    return _904;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _282)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_282.uBackdrop) * _282.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_282.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _282)
{
    float4 _419;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _419 = overBackdrop(param, _282);
    }
    else
    {
        float2 param_1 = fract(uv);
        _419 = float4(testCard(param_1), 1.0);
    }
    return _419;
}

static inline __attribute__((always_inline))
float3 liquidShade(thread const float3& base, thread const float3& n, thread const float& gloss)
{
    float3 l = float3(-0.42333376407623291015625, 0.55033385753631591796875, 0.719667375087738037109375);
    float diff = fast::clamp(dot(n, l), 0.0, 1.0);
    float spec = powr(fast::max(dot(reflect(-l, n), float3(0.0, 0.0, 1.0)), 0.0), 36.0);
    float rim = powr(1.0 - n.z, 2.0);
    return (((base * (0.449999988079071044921875 + (0.699999988079071044921875 * diff))) * (1.0 - (0.3499999940395355224609375 * rim))) + (float3(spec) * gloss)) + float3((rim * 0.119999997317790985107421875) * gloss);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, thread float& aspect, constant FlairUniforms& _282, texture2d<float> uImage, sampler uImageSmplr)
{
    aspect = _282.iResolution[0u] / _282.iResolution[1u];
    float2 uv = fragCoord / float2(_282.iResolution[0], _282.iResolution[1]);
    float px = 1.0 / _282.iResolution[1u];
    float _928;
    if (_282.uAnimate != 0u)
    {
        float param = _282.uSpeed;
        _928 = meltCycle(param, _282);
    }
    else
    {
        _928 = _282.uProgress;
    }
    float m = _928;
    float eps = 0.00150000001303851604461669921875;
    float4 xs = float4(uv.x) + float4(-0.0040000001899898052215576171875, 0.0, eps / aspect, 0.0);
    float4 ys = float4(uv.y) + float4(0.0089999996125698089599609375, 0.0, 0.0, eps);
    float param_1 = xs.x;
    float param_2 = m;
    float param_3 = xs.y;
    float param_4 = m;
    float param_5 = xs.z;
    float param_6 = m;
    float3 edge3 = float3(edgeY(param_1, param_2), edgeY(param_3, param_4), edgeY(param_5, param_6));
    float param_7 = xs.x;
    float param_8 = m;
    float param_9 = xs.y;
    float param_10 = m;
    float param_11 = xs.z;
    float param_12 = m;
    float3 pool3 = float3(poolY(param_7, param_8, _282), poolY(param_9, param_10, _282), poolY(param_11, param_12, _282));
    float4 param_13 = xs;
    float4 param_14 = ys;
    float4 param_15 = edge3.xyzy;
    float4 param_16 = pool3.xyzy;
    float param_17 = m;
    float4 param_18 = float4(0.01200000010430812835693359375, 4.0 * px, float2((4.0 * px) + 0.004999999888241291046142578125));
    float4 liq = liquid(param_13, param_14, param_15, param_16, param_17, param_18, aspect, _282);
    float e = edge3.y;
    float h = fast::clamp(uv.y / e, 0.0, 1.0);
    float ys0 = 1.0 - powr(1.0 - h, 1.0 + (m * 1.2999999523162841796875));
    float xs0 = uv.x + ((m * 0.006000000052154064178466796875) * sin((uv.y * 40.0) + (uv.x * 13.0)));
    float2 param_19 = float2(xs0, ys0);
    float4 col = pictureRGBA(uImage, uImageSmplr, param_19, _282);
    float4 behind = float4(float3(_282.uBackground) * (0.75 + (0.5 * uv.y)), _282.uBackdropAlpha);
    col = mix(col, behind, float4(smoothstep(e - px, e + px, uv.y)));
    float shadow = liq.x;
    float4 _1107 = col;
    float3 _1109 = _1107.xyz * (1.0 - ((0.4000000059604644775390625 * smoothstep(0.01200000010430812835693359375, -0.0040000001899898052215576171875, shadow)) * smoothstep(0.0, 0.100000001490116119384765625, m)));
    col.x = _1109.x;
    col.y = _1109.y;
    col.z = _1109.z;
    float d = liq.y;
    if (d < (4.0 * px))
    {
        float2 g = float2(liq.z - d, liq.w - d);
        g /= float2(fast::max(length(g), 9.9999997473787516355514526367188e-06));
        float thick = sqrt(fast::clamp((-d) / 0.017999999225139617919921875, 0.0, 1.0));
        float3 nrm = fast::normalize(float3((g * (1.0 - thick)) * 1.60000002384185791015625, 0.4000000059604644775390625 + thick));
        float2 param_20 = float2(uv.x + (0.00999999977648258209228515625 * sin(uv.y * 25.0)), 0.964999973773956298828125);
        float4 top = pictureRGBA(uImage, uImageSmplr, param_20, _282);
        float sx = uv.x + (0.039999999105930328369140625 * sin((uv.x * 11.0) + (uv.y * 30.0)));
        float2 param_21 = float2(sx - 0.0599999986588954925537109375, 0.25);
        float2 param_22 = float2(sx + 0.0599999986588954925537109375, 0.4000000059604644775390625);
        float2 param_23 = float2(sx, 0.89999997615814208984375);
        float4 pool = ((pictureRGBA(uImage, uImageSmplr, param_21, _282) + pictureRGBA(uImage, uImageSmplr, param_22, _282)) + pictureRGBA(uImage, uImageSmplr, param_23, _282)) / float4(3.0);
        float inPool = smoothstep(pool3.y + 0.039999999105930328369140625, pool3.y - 0.00999999977648258209228515625, uv.y);
        float4 base = mix(top, pool, float4(inPool));
        float2 param_24 = float2(uv.x * 90.0, uv.y * 3.0);
        float4 _1238 = base;
        float3 _1240 = _1238.xyz * (0.89999997615814208984375 + (0.119999997317790985107421875 * vnoise(param_24)));
        base.x = _1240.x;
        base.y = _1240.y;
        base.z = _1240.z;
        float3 param_25 = base.xyz * 1.0499999523162841796875;
        float3 param_26 = nrm;
        float param_27 = _282.uGloss;
        float3 wet = liquidShade(param_25, param_26, param_27);
        col = mix(col, float4(wet, base.w), float4(smoothstep(px, -px, d)));
    }
    fragColor = col;
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
    float3 _1319;
    if (a > 0.0)
    {
        _1319 = bg + (d / float3(a));
    }
    else
    {
        _1319 = bg;
    }
    float3 fg = _1319;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1341;
    if (alpha > 0.0)
    {
        _1341 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1341 = bg;
    }
    float3 col = _1341;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& aspect, constant FlairUniforms& _282, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, aspect, _282, uImage, uImageSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_282.uBackground);
    float param_4 = _282.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_drip_melt_frag_out flair_drip_melt_frag(constant FlairUniforms& _282 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_drip_melt_frag_out out = {};
    float aspect = 1.0;
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1398;
    if (_282.flair_flipY > 0.5)
    {
        _1398 = _282.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1398 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1398);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, aspect, _282, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

