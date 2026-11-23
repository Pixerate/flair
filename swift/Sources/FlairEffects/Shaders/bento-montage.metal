// flair-metal-hash: ac41ab03
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
    int uCount;
    float uGap;
    float uRadius;
    float uMargin;
    float uHold;
    float uSpotlight;
    float uLift;
    char _m20_pad[4];
    packed_float3 uAccent;
    float uRing;
    float uShadow;
    char _m23_pad[12];
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_bento_montage_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
float4 spotlight(thread const float& t, thread const float& start, thread const float& hold, thread const int& n)
{
    float c = (t - start) / fast::max(hold, 0.100000001490116119384765625);
    if ((c < 0.0) || (n < 1))
    {
        return float4(-1.0, 0.0, -1.0, 0.0);
    }
    float k = floor(c);
    float param = ((c - k) * hold) / 0.449999988079071044921875;
    float _591 = ease(param);
    float w = _591;
    float h = mod(k, float(n));
    float _600;
    if (k >= 1.0)
    {
        _600 = mod(k - 1.0, float(n));
    }
    else
    {
        _600 = -1.0;
    }
    float prev = _600;
    return float4(h, w, prev, 1.0 - w);
}

static inline __attribute__((always_inline))
float spotWeight(thread const float4& s, thread const int& i)
{
    float _623;
    if (int(s.x) == i)
    {
        _623 = s.y;
    }
    else
    {
        _623 = 0.0;
    }
    float _636;
    if (int(s.z) == i)
    {
        _636 = s.w;
    }
    else
    {
        _636 = 0.0;
    }
    return _623 + _636;
}

static inline __attribute__((always_inline))
float4 bentoRect(thread const int& i, thread const int& n)
{
    if (n <= 1)
    {
        return float4(0.0, 0.0, 1.0, 1.0);
    }
    if (n == 2)
    {
        return select(float4(0.60000002384185791015625, 0.0, 0.4000000059604644775390625, 1.0), float4(0.0, 0.0, 0.60000002384185791015625, 1.0), bool4(i == 0));
    }
    if (n == 3)
    {
        float4 _672;
        if (i == 0)
        {
            _672 = float4(0.0, 0.0, 0.60000002384185791015625, 1.0);
        }
        else
        {
            _672 = select(float4(0.60000002384185791015625, 0.5, 0.4000000059604644775390625, 0.5), float4(0.60000002384185791015625, 0.0, 0.4000000059604644775390625, 0.5), bool4(i == 1));
        }
        return _672;
    }
    if (n == 4)
    {
        float4 _690;
        if (i == 0)
        {
            _690 = float4(0.0, 0.0, 0.60000002384185791015625, 0.60000002384185791015625);
        }
        else
        {
            float4 _697;
            if (i == 1)
            {
                _697 = float4(0.60000002384185791015625, 0.0, 0.4000000059604644775390625, 0.60000002384185791015625);
            }
            else
            {
                _697 = select(float4(0.4000000059604644775390625, 0.60000002384185791015625, 0.60000002384185791015625, 0.4000000059604644775390625), float4(0.0, 0.60000002384185791015625, 0.4000000059604644775390625, 0.4000000059604644775390625), bool4(i == 2));
            }
            _690 = _697;
        }
        return _690;
    }
    if (n == 5)
    {
        float4 _718;
        if (i == 0)
        {
            _718 = float4(0.0, 0.0, 0.5, 0.60000002384185791015625);
        }
        else
        {
            float4 _725;
            if (i == 1)
            {
                _725 = float4(0.5, 0.0, 0.25, 0.60000002384185791015625);
            }
            else
            {
                float4 _733;
                if (i == 2)
                {
                    _733 = float4(0.75, 0.0, 0.25, 0.60000002384185791015625);
                }
                else
                {
                    _733 = select(float4(0.60000002384185791015625, 0.60000002384185791015625, 0.4000000059604644775390625, 0.4000000059604644775390625), float4(0.0, 0.60000002384185791015625, 0.60000002384185791015625, 0.4000000059604644775390625), bool4(i == 3));
                }
                _725 = _733;
            }
            _718 = _725;
        }
        return _718;
    }
    float4 _751;
    if (i == 0)
    {
        _751 = float4(0.0, 0.0, 0.5, 0.63999998569488525390625);
    }
    else
    {
        float4 _759;
        if (i == 1)
        {
            _759 = float4(0.5, 0.0, 0.5, 0.319999992847442626953125);
        }
        else
        {
            float4 _766;
            if (i == 2)
            {
                _766 = float4(0.5, 0.319999992847442626953125, 0.25, 0.319999992847442626953125);
            }
            else
            {
                float4 _773;
                if (i == 3)
                {
                    _773 = float4(0.75, 0.319999992847442626953125, 0.25, 0.319999992847442626953125);
                }
                else
                {
                    _773 = select(float4(0.319999992847442626953125, 0.63999998569488525390625, 0.680000007152557373046875, 0.36000001430511474609375), float4(0.0, 0.63999998569488525390625, 0.319999992847442626953125, 0.36000001430511474609375), bool4(i == 4));
                }
                _766 = _773;
            }
            _759 = _766;
        }
        _751 = _759;
    }
    return _751;
}

static inline __attribute__((always_inline))
float easeOut(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return 1.0 - (((1.0 - t) * (1.0 - t)) * (1.0 - t));
}

static inline __attribute__((always_inline))
float tileBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
int2 itemSize(thread const int& i, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        return int2(uItem0.get_width(), uItem0.get_height());
    }
    if (i == 1)
    {
        return int2(uItem1.get_width(), uItem1.get_height());
    }
    if (i == 2)
    {
        return int2(uItem2.get_width(), uItem2.get_height());
    }
    if (i == 3)
    {
        return int2(uItem3.get_width(), uItem3.get_height());
    }
    if (i == 4)
    {
        return int2(uItem4.get_width(), uItem4.get_height());
    }
    return int2(uItem5.get_width(), uItem5.get_height());
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _120)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_120.uBackdrop) * _120.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_120.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _120)
{
    float4 _263;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _263 = overBackdrop(param, _120);
    }
    else
    {
        float2 param_1 = fract(uv);
        _263 = float4(testCard(param_1), 1.0);
    }
    return _263;
}

static inline __attribute__((always_inline))
float4 itemAt(thread const int& i, thread const float2& uv, constant FlairUniforms& _120, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        float2 param = uv;
        return pictureRGBA(uItem0, uItem0Smplr, param, _120);
    }
    if (i == 1)
    {
        float2 param_1 = uv;
        return pictureRGBA(uItem1, uItem1Smplr, param_1, _120);
    }
    if (i == 2)
    {
        float2 param_2 = uv;
        return pictureRGBA(uItem2, uItem2Smplr, param_2, _120);
    }
    if (i == 3)
    {
        float2 param_3 = uv;
        return pictureRGBA(uItem3, uItem3Smplr, param_3, _120);
    }
    if (i == 4)
    {
        float2 param_4 = uv;
        return pictureRGBA(uItem4, uItem4Smplr, param_4, _120);
    }
    float2 param_5 = uv;
    return pictureRGBA(uItem5, uItem5Smplr, param_5, _120);
}

static inline __attribute__((always_inline))
float4 itemCover(thread const int& i, thread float2& uv, thread const float& aspect, constant FlairUniforms& _120, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int2 ts = itemSize(param, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    bool _513 = ts.x > 1;
    bool _519;
    if (_513)
    {
        _519 = ts.y > 1;
    }
    else
    {
        _519 = _513;
    }
    if (_519)
    {
        float ta = float(ts.x) / float(ts.y);
        if (ta > aspect)
        {
            uv.x = (((uv.x - 0.5) * aspect) / ta) + 0.5;
        }
        else
        {
            uv.y = (((uv.y - 0.5) * ta) / aspect) + 0.5;
        }
    }
    int param_1 = i;
    float2 param_2 = uv;
    return itemAt(param_1, param_2, _120, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
}

static inline __attribute__((always_inline))
void drawTile(thread float4& acc, thread const float2& p, thread const int& i, thread const int& n, thread const float2& grid, thread const float& w, thread const float& dim, thread const float& px, constant FlairUniforms& _120, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int param_1 = n;
    float4 r = bentoRect(param, param_1);
    float2 half_ = fast::max((r.zw * grid) - float2(0.5 * _120.uGap), float2(0.001000000047497451305389404296875));
    float2 centre = float2(((-grid.x) + ((2.0 * grid.x) * r.x)) + (r.z * grid.x), (grid.y - ((2.0 * grid.y) * r.y)) - (r.w * grid.y));
    float param_2 = (_120.iTime - (0.119999997317790985107421875 * float(i))) / 0.699999988079071044921875;
    float _854 = easeOut(param_2);
    float a = _854;
    float scale = mix(0.819999992847442626953125, 1.0, a) * (1.0 + (_120.uLift * w));
    float2 q = ((p - centre) - float2(0.0, (-0.07999999821186065673828125) * (1.0 - a))) / float2(scale);
    float2 param_3 = q;
    float2 param_4 = half_;
    float param_5 = _120.uRadius;
    float d = tileBox(param_3, param_4, param_5);
    float lift = w;
    float2 param_6 = q - float2(0.0, (-0.0199999995529651641845703125) - (0.02999999932944774627685546875 * lift));
    float2 param_7 = half_;
    float param_8 = _120.uRadius;
    float4 param_9 = acc;
    float3 param_10 = float3(0.0);
    float param_11 = (((_120.uShadow * (0.25 + (0.5 * lift))) * a) * exp(-powr(fast::max(tileBox(param_6, param_7, param_8), 0.0) / (0.014999999664723873138427734375 + (0.039999999105930328369140625 * lift)), 2.0))) * step(0.0, d);
    acc = over(param_9, param_10, param_11);
    float cover = smoothstep(px, -px, d) * a;
    if (cover <= 0.0)
    {
        return;
    }
    float2 uv = (q / (half_ * 2.0)) + float2(0.5);
    int param_12 = i;
    float2 param_13 = uv;
    float param_14 = half_.x / half_.y;
    float4 _965 = itemCover(param_12, param_13, param_14, _120, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    float4 pic = _965;
    float off = dim * (1.0 - w);
    float3 col = mix(pic.xyz, float3(dot(pic.xyz, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625))) * 0.4000000059604644775390625, float3(off));
    float4 param_15 = acc;
    float3 param_16 = col;
    float param_17 = cover * pic.w;
    acc = over(param_15, param_16, param_17);
    float ring = (smoothstep(px, -px, abs(d + 0.0040000001899898052215576171875) - 0.0030000000260770320892333984375) * w) * _120.uRing;
    float4 param_18 = acc;
    float3 param_19 = float3(_120.uAccent);
    float param_20 = ring * a;
    acc = over(param_18, param_19, param_20);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _120)
{
    float4 base = float4(float3(_120.uBackground) * _120.uBackgroundAlpha, _120.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _120, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float2 p = (fragCoord - (float2(_120.iResolution[0], _120.iResolution[1]) * 0.5)) / float2(_120.iResolution[1u]);
    float px = 1.0 / _120.iResolution[1u];
    int n = clamp(_120.uCount, 1, 6);
    float2 grid = fast::max(float2(((0.5 * _120.iResolution[0u]) / _120.iResolution[1u]) - _120.uMargin, 0.5 - _120.uMargin), float2(0.0500000007450580596923828125));
    float start = ((0.119999997317790985107421875 * float(n - 1)) + 0.699999988079071044921875) + 0.800000011920928955078125;
    float param = _120.iTime;
    float param_1 = start;
    float param_2 = _120.uHold;
    int param_3 = n;
    float4 s = spotlight(param, param_1, param_2, param_3);
    float dim = _120.uSpotlight * fast::clamp((_120.iTime - start) / 0.449999988079071044921875, 0.0, 1.0);
    float4 acc = float4(0.0);
    int top = int(s.x);
    for (int i = 0; i < 6; i++)
    {
        if (i >= n)
        {
            break;
        }
        if (i != top)
        {
            float4 param_4 = s;
            int param_5 = i;
            float4 param_6 = acc;
            float2 param_7 = p;
            int param_8 = i;
            int param_9 = n;
            float2 param_10 = grid;
            float param_11 = spotWeight(param_4, param_5);
            float param_12 = dim;
            float param_13 = px;
            drawTile(param_6, param_7, param_8, param_9, param_10, param_11, param_12, param_13, _120, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
            acc = param_6;
        }
    }
    if (top >= 0)
    {
        float4 param_14 = s;
        int param_15 = top;
        float4 param_16 = acc;
        float2 param_17 = p;
        int param_18 = top;
        int param_19 = n;
        float2 param_20 = grid;
        float param_21 = spotWeight(param_14, param_15);
        float param_22 = dim;
        float param_23 = px;
        drawTile(param_16, param_17, param_18, param_19, param_20, param_21, param_22, param_23, _120, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        acc = param_16;
    }
    float4 param_24 = acc;
    fragColor = finish(param_24, _120);
}

fragment flair_bento_montage_frag_out flair_bento_montage_frag(constant FlairUniforms& _120 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], texture2d<float> uItem5 [[texture(6)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], sampler uItem5Smplr [[sampler(6)]], float4 gl_FragCoord [[position]])
{
    flair_bento_montage_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1185;
    if (_120.flair_flipY > 0.5)
    {
        _1185 = _120.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1185 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1185);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _120, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

