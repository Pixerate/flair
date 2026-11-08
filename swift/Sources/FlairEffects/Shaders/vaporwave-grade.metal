// flair-metal-hash: e464f887
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
    uint uGlyphs;
    float3 uPink;
    packed_float3 uCyan;
    float uGrade;
    float uScanlines;
    float uSplit;
    float uBand;
    float uHorizon;
    float uSunX;
    float uSpeed;
    char _m23_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_vaporwave_grade_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _72)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_72.uBackdrop) * _72.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_72.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _72)
{
    float4 _216;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _216 = overBackdrop(param, _72);
    }
    else
    {
        float2 param_1 = fract(uv);
        _216 = float4(testCard(param_1), 1.0);
    }
    return _216;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _72)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _72).xyz;
}

static inline __attribute__((always_inline))
float4 inkBox(texture2d<float> uText, sampler uTextSmplr)
{
    float x0 = 1.0;
    float x1 = 0.0;
    for (int i = 0; i < 32; i++)
    {
        float u = (float(i) + 0.5) / 32.0;
        if (uText.sample(uTextSmplr, float2(u, 0.5), level(4.0)).w > 0.039999999105930328369140625)
        {
            x0 = u;
            break;
        }
    }
    for (int i_1 = 31; i_1 >= 0; i_1--)
    {
        float u_1 = (float(i_1) + 0.5) / 32.0;
        if (uText.sample(uTextSmplr, float2(u_1, 0.5), level(4.0)).w > 0.039999999105930328369140625)
        {
            x1 = u_1;
            break;
        }
    }
    if (x1 < x0)
    {
        return float4(0.0);
    }
    float y0 = 1.0;
    float y1 = 0.0;
    for (int j = 31; j >= 0; j--)
    {
        float v = (float(j) + 0.5) / 32.0;
        float a = 0.0;
        for (int k = 0; k < 3; k++)
        {
            a = fast::max(a, uText.sample(uTextSmplr, float2(mix(x0, x1, (float(k) + 0.5) / 3.0), v), level(3.0)).w);
        }
        if (a > 0.20000000298023223876953125)
        {
            y1 = v;
            break;
        }
    }
    for (int j_1 = 0; j_1 < 32; j_1++)
    {
        float v_1 = (float(j_1) + 0.5) / 32.0;
        float a_1 = 0.0;
        for (int k_1 = 0; k_1 < 3; k_1++)
        {
            a_1 = fast::max(a_1, uText.sample(uTextSmplr, float2(mix(x0, x1, (float(k_1) + 0.5) / 3.0), v_1), level(3.0)).w);
        }
        if (a_1 > 0.20000000298023223876953125)
        {
            y0 = v_1;
            break;
        }
    }
    float4 _432;
    if (y1 > y0)
    {
        _432 = float4(x0, x1, y0, y1);
    }
    else
    {
        _432 = float4(0.0);
    }
    return _432;
}

static inline __attribute__((always_inline))
float2 inkUV(thread const float2& p, thread const float4& ink, thread const float& h, thread const float& maxW, texture2d<float> uText, sampler uTextSmplr)
{
    float2 tsize = float2(int2(uText.get_width(), uText.get_height()));
    float th = h / fast::max(ink.w - ink.z, 0.001000000047497451305389404296875);
    float tw = (th * tsize.x) / fast::max(tsize.y, 1.0);
    float inkW = (ink.y - ink.x) * tw;
    float _481;
    if (inkW > maxW)
    {
        _481 = maxW / inkW;
    }
    else
    {
        _481 = 1.0;
    }
    float fit = _481;
    return float2(((ink.x + ink.y) * 0.5) + (p.x / (tw * fit)), ((ink.z + ink.w) * 0.5) + (p.y / (th * fit)));
}

static inline __attribute__((always_inline))
float words(thread const float2& tuv, texture2d<float> uText, sampler uTextSmplr)
{
    float a = uText.sample(uTextSmplr, fast::clamp(tuv, float2(0.0), float2(1.0))).w;
    bool _256 = all(tuv >= float2(0.0));
    bool _263;
    if (_256)
    {
        _263 = all(tuv <= float2(1.0));
    }
    else
    {
        _263 = _256;
    }
    return _263 ? a : 0.0;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _72, texture2d<float> uText, sampler uTextSmplr, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_72.iResolution[0], _72.iResolution[1]);
    float aspect = _72.iResolution[0u] / _72.iResolution[1u];
    float px = 1.0 / _72.iResolution[1u];
    float2 off = float2(_72.uSplit, 0.0);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _72);
    float2 param_1 = uv + off;
    float2 param_2 = uv - off;
    float3 col = float3(picture(uImage, uImageSmplr, param_1, _72).x, pic.y, picture(uImage, uImageSmplr, param_2, _72).z);
    float l = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 shadow = (float3(_72.uCyan) * 0.300000011920928955078125) + float3(0.100000001490116119384765625, 0.0, 0.20000000298023223876953125);
    float3 graded = mix(shadow, mix(float3(_72.uCyan), _72.uPink, float3(0.5)), float3(smoothstep(0.0, 0.449999988079071044921875, l)));
    graded = mix(graded, mix(_72.uPink, float3(1.0), float3(0.300000011920928955078125)), float3(smoothstep(0.449999988079071044921875, 1.0, l)));
    col = mix(col, mix(col, graded, float3(0.800000011920928955078125)), float3(_72.uGrade));
    col *= (1.0 - ((_72.uScanlines * 0.300000011920928955078125) * (0.5 + (0.5 * sin(fragCoord.y * 2.094399929046630859375)))));
    float cover = 0.0;
    if (_72.uBand > 0.0)
    {
        float2 p = float2(uv.x * aspect, uv.y);
        float2 sc = float2(_72.uSunX * aspect, _72.uHorizon);
        float R = 0.20000000298023223876953125;
        float r = length(p - sc);
        float k = (p.y - _72.uHorizon) / R;
        float disc = smoothstep(R + px, R - px, r) * step(0.0, k);
        float _681;
        if (k < 0.550000011920928955078125)
        {
            _681 = step(fract((k * 8.0) + (_72.iTime * 0.25)), (0.550000011920928955078125 - k) * 1.10000002384185791015625);
        }
        else
        {
            _681 = 0.0;
        }
        float gap = _681;
        float3 sun = mix(_72.uPink, float3(1.0, 0.86000001430511474609375, 0.4199999868869781494140625), float3(smoothstep(0.0, 1.0, k)));
        float sunA = (disc * (1.0 - gap)) * _72.uBand;
        col += (((((_72.uPink * exp((-fast::max(r - R, 0.0)) * 14.0)) * 0.300000011920928955078125) * step(_72.uHorizon, p.y)) * (1.0 - disc)) * _72.uBand);
        col = mix(col, sun, float3(sunA));
        cover = sunA;
        float d = _72.uHorizon - uv.y;
        if (d > 0.0)
        {
            float z = 0.5 / d;
            float2 g = float2((((uv.x - _72.uSunX) * aspect) * z) * 5.0, z + (_72.iTime * _72.uSpeed));
            float2 gw = fwidth(g);
            float2 gl = smoothstep(gw * 1.5, float2(0.0), float2(0.5) - abs(fract(g) - float2(0.5)));
            float line = fast::max(gl.x, gl.y) * smoothstep(0.0, 0.100000001490116119384765625, d);
            float3 floorCol = mix(float3(0.070000000298023223876953125, 0.00999999977648258209228515625, 0.12999999523162841796875), _72.uPink * 0.5, float3(exp((-d) * 30.0)));
            floorCol += (float3(_72.uCyan) * line);
            float a = (_72.uBand * smoothstep(0.0, 0.01200000010430812835693359375, d)) * 0.920000016689300537109375;
            col = mix(col, floorCol, float3(a));
            cover = fast::max(cover, a);
        }
    }
    float top = 0.910000026226043701171875;
    bool _849 = _72.uGlyphs != 0u;
    bool _859;
    if (_849)
    {
        _859 = abs(uv.y - top) < 0.0500000007450580596923828125;
    }
    else
    {
        _859 = _849;
    }
    if (_859)
    {
        float4 ink = inkBox(uText, uTextSmplr);
        if (ink.y > ink.x)
        {
            float2 p_1 = float2((uv.x - 0.5) * aspect, uv.y - top);
            float2 o = float2(0.0040000001899898052215576171875, 0.0);
            float2 param_3 = p_1 + o;
            float4 param_4 = ink;
            float param_5 = 0.0500000007450580596923828125;
            float param_6 = aspect * 0.60000002384185791015625;
            float2 param_7 = inkUV(param_3, param_4, param_5, param_6, uText, uTextSmplr);
            float a_1 = words(param_7, uText, uTextSmplr);
            float2 param_8 = p_1 - o;
            float4 param_9 = ink;
            float param_10 = 0.0500000007450580596923828125;
            float param_11 = aspect * 0.60000002384185791015625;
            float2 param_12 = inkUV(param_8, param_9, param_10, param_11, uText, uTextSmplr);
            float b = words(param_12, uText, uTextSmplr);
            float2 param_13 = p_1;
            float4 param_14 = ink;
            float param_15 = 0.0500000007450580596923828125;
            float param_16 = aspect * 0.60000002384185791015625;
            float2 param_17 = inkUV(param_13, param_14, param_15, param_16, uText, uTextSmplr);
            float c = words(param_17, uText, uTextSmplr);
            float back = smoothstep(0.0500000007450580596923828125, 0.039999999105930328369140625, abs(uv.y - top)) * 0.449999988079071044921875;
            col *= (1.0 - back);
            col = mix(col, _72.uPink, float3(a_1 * 0.89999997615814208984375));
            col = mix(col, float3(_72.uCyan), float3(b * 0.89999997615814208984375));
            col = mix(col, float3(1.0), float3(c));
            cover = fast::max(cover, fast::max(fast::max(back, a_1), fast::max(b, c)));
        }
    }
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, cover));
}

fragment flair_vaporwave_grade_frag_out flair_vaporwave_grade_frag(constant FlairUniforms& _72 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uText [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uTextSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_vaporwave_grade_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _990;
    if (_72.flair_flipY > 0.5)
    {
        _990 = _72.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _990 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _990);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _72, uText, uTextSmplr, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

