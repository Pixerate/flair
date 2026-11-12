// flair-metal-hash: ef77eafd
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
    uint uAnimate;
    float uProgress;
    float uGutter;
    float uBorder;
    float3 uGutterColor;
    float3 uInk;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_comic_panels_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float side(thread const float2& uv, thread const float2& a, thread const float2& b, constant FlairUniforms& _63)
{
    float2 p = uv * float2(_63.iResolution[0], _63.iResolution[1]);
    float2 pa = a * float2(_63.iResolution[0], _63.iResolution[1]);
    float2 ab = fast::normalize((b - a) * float2(_63.iResolution[0], _63.iResolution[1]));
    float2 q = p - pa;
    return (ab.x * q.y) - (ab.y * q.x);
}

static inline __attribute__((always_inline))
float backOut(thread float& t)
{
    float s = 2.2000000476837158203125;
    t -= 1.0;
    return 1.0 + ((t * t) * (((s + 1.0) * t) + s));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _63)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_63.uBackdrop) * _63.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_63.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _63)
{
    float4 _207;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _207 = overBackdrop(param, _63);
    }
    else
    {
        float2 param_1 = fract(uv);
        _207 = float4(testCard(param_1), 1.0);
    }
    return _207;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _63, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_63.iResolution[0], _63.iResolution[1]);
    float _294;
    if (_63.uAnimate != 0u)
    {
        _294 = smoothstep(0.07999999821186065673828125, 0.920000016689300537109375, 0.5 - (0.5 * cos((_63.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _294 = _63.uProgress;
    }
    float p = _294;
    float2 param = uv;
    float2 param_1 = float2(0.0, 0.5);
    float2 param_2 = float2(1.0, 0.550000011920928955078125);
    float tier = side(param, param_1, param_2, _63);
    float2 param_3 = uv;
    float2 param_4 = float2(0.60000002384185791015625, 1.0);
    float2 param_5 = float2(0.550000011920928955078125, 0.5);
    float cutTop = side(param_3, param_4, param_5, _63);
    float2 param_6 = uv;
    float2 param_7 = float2(0.36000001430511474609375, 0.0);
    float2 param_8 = float2(0.310000002384185791015625, 0.550000011920928955078125);
    float cutA = side(param_6, param_7, param_8, _63);
    float2 param_9 = uv;
    float2 param_10 = float2(0.699999988079071044921875, 0.0);
    float2 param_11 = float2(0.7400000095367431640625, 0.550000011920928955078125);
    float cutB = side(param_9, param_10, param_11, _63);
    float edge;
    int panel;
    float2 lo;
    float2 size;
    if (tier > 0.0)
    {
        edge = fast::min(tier, abs(cutTop));
        if (cutTop < 0.0)
        {
            panel = 0;
            lo = float2(0.0, 0.5);
            size = float2(0.60000002384185791015625, 0.5);
        }
        else
        {
            panel = 1;
            lo = float2(0.550000011920928955078125, 0.5);
            size = float2(0.449999988079071044921875, 0.5);
        }
    }
    else
    {
        edge = -tier;
        if (cutA > 0.0)
        {
            panel = 2;
            lo = float2(0.0);
            size = float2(0.36000001430511474609375, 0.550000011920928955078125);
            edge = fast::min(edge, cutA);
        }
        else
        {
            if (cutB > 0.0)
            {
                panel = 3;
                lo = float2(0.310000002384185791015625, 0.0);
                size = float2(0.430000007152557373046875, 0.550000011920928955078125);
                edge = fast::min(edge, fast::min(-cutA, cutB));
            }
            else
            {
                panel = 4;
                lo = float2(0.699999988079071044921875, 0.0);
                size = float2(0.300000011920928955078125, 0.550000011920928955078125);
                edge = fast::min(edge, -cutB);
            }
        }
    }
    float2 framePx = fast::min(fragCoord, float2(_63.iResolution[0], _63.iResolution[1]) - fragCoord);
    edge = fast::min(edge, fast::min(framePx.x, framePx.y));
    float open = smoothstep(0.0, 0.14000000059604644775390625, p) * (1.0 - smoothstep(0.86000001430511474609375, 1.0, p));
    float gutter = ((0.5 * _63.uGutter) * _63.iResolution[1u]) * open;
    float border = _63.uBorder * open;
    float t = fast::clamp(((p - 0.119999997317790985107421875) - (float(panel) * 0.119999997317790985107421875)) / 0.2599999904632568359375, 0.0, 1.0);
    float e = 1.0 - powr(1.0 - t, 3.0);
    float2 local = (uv - lo) / size;
    float2 st = uv;
    float showTo = 0.0;
    float rim = 1000.0;
    if (panel == 0)
    {
        showTo = step(local.x, e * 1.0499999523162841796875);
        rim = (abs(local.x - (e * 1.0499999523162841796875)) * size.x) * _63.iResolution[0u];
    }
    else
    {
        if (panel == 1)
        {
            showTo = step(1.0 - e, local.y);
            st.y -= ((1.0 - e) * size.y);
            rim = (abs(local.y - (1.0 - e)) * size.y) * _63.iResolution[1u];
        }
        else
        {
            if (panel == 2)
            {
                float param_12 = t;
                float _535 = backOut(param_12);
                float s = fast::max(_535, 0.001000000047497451305389404296875);
                float2 c = lo + (size * 0.5);
                float2 q = (uv - c) / float2(s);
                float2 qa = abs(q) / size;
                showTo = step(fast::max(qa.x, qa.y), 0.5) * step(0.001000000047497451305389404296875, t);
                st = c + q;
                rim = ((0.5 - fast::max(qa.x, qa.y)) * fast::min(size.x * _63.iResolution[0u], size.y * _63.iResolution[1u])) * s;
            }
            else
            {
                if (panel == 3)
                {
                    float2 q_1 = ((local * size) * float2(_63.iResolution[0], _63.iResolution[1])) / float2(_63.iResolution[1u]);
                    float radius = e;
                    showTo = step(length(q_1), radius);
                    rim = abs(length(q_1) - radius) * _63.iResolution[1u];
                }
                else
                {
                    showTo = step(1.0 - e, local.x);
                    st.x -= ((1.0 - e) * size.x);
                    rim = (abs(local.x - (1.0 - e)) * size.x) * _63.iResolution[0u];
                }
            }
        }
    }
    float _647;
    if (t >= 1.0)
    {
        _647 = 1.0;
    }
    else
    {
        _647 = (t <= 0.0) ? 0.0 : showTo;
    }
    showTo = _647;
    float2 param_13 = uv;
    float2 param_14 = st;
    float4 col = mix(pictureRGBA(uFrom, uFromSmplr, param_13, _63), pictureRGBA(uTo, uToSmplr, param_14, _63), float4(showTo));
    float moving = step(0.001000000047497451305389404296875, t) * step(t, 0.999000012874603271484375);
    col = mix(col, float4(_63.uInk, 1.0), float4(moving * fast::clamp(2.0 - rim, 0.0, 1.0)));
    float4 frame = mix(float4(_63.uGutterColor, 1.0), float4(_63.uInk, 1.0), float4(fast::clamp((edge - gutter) + 0.5, 0.0, 1.0)));
    float inside = mix(1.0, fast::clamp(((edge - gutter) - border) + 0.5, 0.0, 1.0), smoothstep(0.0, 0.20000000298023223876953125, open));
    fragColor = mix(frame, col, float4(inside));
}

fragment flair_transition_comic_panels_frag_out flair_transition_comic_panels_frag(constant FlairUniforms& _63 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_comic_panels_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _741;
    if (_63.flair_flipY > 0.5)
    {
        _741 = _63.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _741 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _741);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _63, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

